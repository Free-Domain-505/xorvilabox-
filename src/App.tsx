import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar.js';
import { Footer } from './components/Footer.js';
import { FileManager } from './components/FileManager.js';
import { StorageView } from './components/StorageView.js';
import { SettingsView } from './components/SettingsView.js';

// Modals
import { NewFolderModal } from './components/NewFolderModal.js';
import { UploadModal } from './components/UploadModal.js';
import { ImportUrlModal } from './components/ImportUrlModal.js';
import { ImportZipModal } from './components/ImportZipModal.js';
import { RawUrlModal } from './components/RawUrlModal.js';
import { VideoPlayerModal } from './components/VideoPlayerModal.js';
import { RenameModal } from './components/RenameModal.js';
import { MoveModal } from './components/MoveModal.js';
import { DetailsModal } from './components/DetailsModal.js';
import { DeleteConfirmModal } from './components/DeleteConfirmModal.js';
import { LoginModal } from './components/LoginModal.js';

// Transfers System
import { TransferProvider, useTransfers } from './context/TransferContext.js';
import { TransferManager } from './components/TransferManager.js';
import { CompactTransferBar } from './components/CompactTransferBar.js';

import { type User, type Folder, type FileItem, type BreadcrumbItem, type TransferItem } from './types.js';

function AppContent() {
  const [currentTab, setCurrentTab] = useState<'files' | 'storage' | 'settings'>('files');
  const [user, setUser] = useState<User | null>(null);

  // Folder navigation state
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Storage path cache for footer
  const [storagePath, setStoragePath] = useState<string>('/var/lib/xorvilabox/storage');

  // Modals state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showImportUrlModal, setShowImportUrlModal] = useState(false);
  const [showImportZipModal, setShowImportZipModal] = useState(false);

  // Selected item modal targets
  const [activeRawFile, setActiveRawFile] = useState<FileItem | null>(null);
  const [activeVideoFile, setActiveVideoFile] = useState<FileItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ item: FileItem | Folder; isFolder: boolean } | null>(null);
  const [moveTarget, setMoveTarget] = useState<FileItem | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<{ item: FileItem | Folder; isFolder: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ item: FileItem | Folder; isFolder: boolean } | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { subscribeCompleted } = useTransfers();

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  // Check auth
  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  };

  // Fetch folders & files for current folder
  const loadFolderContents = useCallback(async (folderId: string | null) => {
    setLoading(true);
    try {
      const folderParam = folderId ? `?parentId=${folderId}` : '';
      const [foldersRes, filesRes] = await Promise.all([
        fetch(`/api/folders${folderParam}`),
        fetch(`/api/files${folderParam ? '?folderId=' + folderId : ''}`),
      ]);

      if (foldersRes.ok) {
        const data = await foldersRes.json();
        setFolders(data.folders || []);
      }
      if (filesRes.ok) {
        const data = await filesRes.json();
        setFiles(data.files || []);
      }

      // Fetch breadcrumbs if inside a folder
      if (folderId) {
        const bcRes = await fetch(`/api/folders/${folderId}/breadcrumbs`);
        if (bcRes.ok) {
          const bcData = await bcRes.json();
          setBreadcrumbs(bcData.breadcrumbs || []);
        }
      } else {
        setBreadcrumbs([]);
      }
    } catch (err) {
      console.error('Failed to load folder contents', err);
      showToast('Failed to load filesystem contents');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Hook up automatic completion behavior:
  // "When an upload or import finishes:
  // - update the transfer state to Completed
  // - refresh the current folder files if the file belongs to it
  // - trigger anime episode detection
  // - enable the Copy Raw URL action
  // - update storage statistics"
  useEffect(() => {
    const unsubscribe = subscribeCompleted((completedItem: TransferItem) => {
      const currentFolderId = currentFolder ? currentFolder.id : null;
      const targetFolderId = completedItem.targetFolderId || null;

      if (currentFolderId === targetFolderId) {
        loadFolderContents(currentFolderId);
      }

      showToast(`✓ ${completedItem.filename} ready on VPS storage`);
    });

    return unsubscribe;
  }, [subscribeCompleted, currentFolder, loadFolderContents, showToast]);

  // Fetch initial data
  useEffect(() => {
    checkAuth();
    loadFolderContents(null);

    // Fetch storage path once
    fetch('/api/stats')
      .then((r) => r.json())
      .then((data) => {
        if (data?.disk?.storagePath) {
          setStoragePath(data.disk.storagePath);
        }
      })
      .catch(() => {});
  }, [loadFolderContents]);

  const handleNavigateFolder = (folder: Folder | null) => {
    setCurrentFolder(folder);
    loadFolderContents(folder ? folder.id : null);
  };

  const handleOpenTransferFolder = async (targetFolderId: string | null) => {
    setCurrentTab('files');
    if (!targetFolderId) {
      setCurrentFolder(null);
      loadFolderContents(null);
      return;
    }

    try {
      const res = await fetch(`/api/folders`);
      if (res.ok) {
        const data = await res.json();
        const found = (data.folders as Folder[]).find((f) => f.id === targetFolderId);
        if (found) {
          setCurrentFolder(found);
          loadFolderContents(found.id);
          return;
        }
      }
      loadFolderContents(targetFolderId);
    } catch {
      loadFolderContents(targetFolderId);
    }
  };

  const handleCopyTransferRawUrl = (rawUrl: string) => {
    const fullUrl = rawUrl.startsWith('http') ? rawUrl : `${window.location.origin}${rawUrl}`;
    navigator.clipboard.writeText(fullUrl);
    showToast('Raw URL copied to clipboard');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      localStorage.removeItem('xorvila_token');
      setUser(null);
      showToast('Logged out of XorvilaBox');
    } catch (err) {
      console.error(err);
    }
  };

  const refreshCurrentView = () => {
    loadFolderContents(currentFolder ? currentFolder.id : null);
  };

  const handleCopyRawUrl = (file: FileItem) => {
    navigator.clipboard.writeText(file.raw_url);
    showToast('Raw URL copied to clipboard');
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-orange-500 selection:text-white">
      
      {/* Navigation Header */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        user={user}
        onOpenLogin={() => setShowLoginModal(true)}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {currentTab === 'files' && (
          <FileManager
            currentFolder={currentFolder}
            breadcrumbs={breadcrumbs}
            folders={folders}
            files={files}
            loading={loading}
            onNavigateFolder={handleNavigateFolder}
            onOpenNewFolderModal={() => setShowNewFolderModal(true)}
            onOpenUploadModal={() => setShowUploadModal(true)}
            onOpenImportUrlModal={() => setShowImportUrlModal(true)}
            onOpenImportZipModal={() => setShowImportZipModal(true)}
            onOpenRawModal={(f) => setActiveRawFile(f)}
            onOpenVideoPlayer={(f) => setActiveVideoFile(f)}
            onCopyRawUrl={handleCopyRawUrl}
            onRenameItem={(item, isFolder) => setRenameTarget({ item, isFolder })}
            onMoveFile={(f) => setMoveTarget(f)}
            onDeleteItem={(item, isFolder) => setDeleteTarget({ item, isFolder })}
            onShowDetails={(item, isFolder) => setDetailsTarget({ item, isFolder })}
            isAuthenticated={!!user}
          />
        )}

        {currentTab === 'storage' && (
          <StorageView onShowToast={showToast} />
        )}

        {currentTab === 'settings' && (
          <SettingsView
            user={user}
            onShowToast={showToast}
            onOpenLogin={() => setShowLoginModal(true)}
          />
        )}
      </main>

      {/* Pure Black Footer */}
      <Footer
        onNavigate={(tab) => setCurrentTab(tab)}
        storagePath={storagePath}
      />

      {/* Real-time Transfer Progress System Components */}
      <TransferManager
        onOpenFolder={handleOpenTransferFolder}
        onCopyRawUrl={handleCopyTransferRawUrl}
      />
      <CompactTransferBar />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 border border-orange-500/50 shadow-xl shadow-orange-950/40 text-zinc-100 text-xs px-4 py-3 rounded-xl flex items-center gap-2.5 animate-in slide-in-from-bottom-3 duration-200">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Modals */}
      {showNewFolderModal && (
        <NewFolderModal
          parentId={currentFolder ? currentFolder.id : null}
          parentName={currentFolder ? currentFolder.name : 'Home Root'}
          onClose={() => setShowNewFolderModal(false)}
          onSuccess={refreshCurrentView}
          onShowToast={showToast}
        />
      )}

      {showUploadModal && (
        <UploadModal
          folderId={currentFolder ? currentFolder.id : null}
          folderUid={currentFolder ? currentFolder.folder_uid : null}
          folderName={currentFolder ? currentFolder.name : 'Home Root'}
          onClose={() => setShowUploadModal(false)}
          onSuccess={refreshCurrentView}
          onShowToast={showToast}
        />
      )}

      {showImportUrlModal && (
        <ImportUrlModal
          folderId={currentFolder ? currentFolder.id : null}
          folderUid={currentFolder ? currentFolder.folder_uid : null}
          folderName={currentFolder ? currentFolder.name : 'Home Root'}
          onClose={() => setShowImportUrlModal(false)}
          onSuccess={refreshCurrentView}
          onShowToast={showToast}
        />
      )}

      {showImportZipModal && (
        <ImportZipModal
          folderId={currentFolder ? currentFolder.id : null}
          folderUid={currentFolder ? currentFolder.folder_uid : null}
          folderName={currentFolder ? currentFolder.name : 'Home Root'}
          onClose={() => setShowImportZipModal(false)}
          onSuccess={refreshCurrentView}
          onShowToast={showToast}
        />
      )}

      {activeRawFile && (
        <RawUrlModal
          file={activeRawFile}
          onClose={() => setActiveRawFile(null)}
          onShowToast={showToast}
        />
      )}

      {activeVideoFile && (
        <VideoPlayerModal
          file={activeVideoFile}
          onClose={() => setActiveVideoFile(null)}
          onShowToast={showToast}
        />
      )}

      {renameTarget && (
        <RenameModal
          item={renameTarget.item}
          isFolder={renameTarget.isFolder}
          onClose={() => setRenameTarget(null)}
          onSuccess={refreshCurrentView}
          onShowToast={showToast}
        />
      )}

      {moveTarget && (
        <MoveModal
          file={moveTarget}
          folders={folders}
          onClose={() => setMoveTarget(null)}
          onSuccess={refreshCurrentView}
          onShowToast={showToast}
        />
      )}

      {detailsTarget && (
        <DetailsModal
          item={detailsTarget.item}
          isFolder={detailsTarget.isFolder}
          onClose={() => setDetailsTarget(null)}
          onShowToast={showToast}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          item={deleteTarget.item}
          isFolder={deleteTarget.isFolder}
          onClose={() => setDeleteTarget(null)}
          onSuccess={refreshCurrentView}
          onShowToast={showToast}
        />
      )}

      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={(u) => setUser(u)}
          onShowToast={showToast}
        />
      )}

    </div>
  );
}

export default function App() {
  return (
    <TransferProvider>
      <AppContent />
    </TransferProvider>
  );
}
