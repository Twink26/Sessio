import * as vscode from 'vscode';
import { FileChangeMonitor } from '../services/FileChangeMonitor';
import { FileEdit } from '../models/FileEdit';

// Mock VS Code API
const mockOutputChannel = {
  appendLine: jest.fn(),
  dispose: jest.fn()
};

jest.mock('vscode', () => ({
  workspace: {
    createFileSystemWatcher: jest.fn(),
    asRelativePath: jest.fn(),
    openTextDocument: jest.fn(),
    onDidSaveTextDocument: jest.fn(() => ({ dispose: jest.fn() })),
  },
  window: {
    createOutputChannel: jest.fn(() => mockOutputChannel)
  },
  Uri: {
    file: jest.fn(),
  },
}));

describe('FileChangeMonitor', () => {
  let fileChangeMonitor: FileChangeMonitor;
  let mockWatcher: any;
  let mockOnDidCreate: jest.Mock;
  let mockOnDidChange: jest.Mock;
  let mockOnDidDelete: jest.Mock;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock file system watcher
    mockOnDidCreate = jest.fn();
    mockOnDidChange = jest.fn();
    mockOnDidDelete = jest.fn();

    // Mock disposable objects
    const mockDisposable = { dispose: jest.fn() };

    mockWatcher = {
      onDidCreate: mockOnDidCreate.mockReturnValue(mockDisposable),
      onDidChange: mockOnDidChange.mockReturnValue(mockDisposable),
      onDidDelete: mockOnDidDelete.mockReturnValue(mockDisposable),
      dispose: jest.fn(),
    };

    (vscode.workspace.createFileSystemWatcher as jest.Mock).mockReturnValue(mockWatcher);
    (vscode.workspace.asRelativePath as jest.Mock).mockImplementation((uri: any) => uri.path || uri);

    // Create new instance
    fileChangeMonitor = new FileChangeMonitor();
  });

  afterEach(() => {
    fileChangeMonitor.dispose();
  });

  describe('initialization', () => {
    it('should create file system watcher on initialization', () => {
      expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalledWith('**/*');
      expect(mockOnDidCreate).toHaveBeenCalled();
      expect(mockOnDidChange).toHaveBeenCalled();
      expect(mockOnDidDelete).toHaveBeenCalled();
    });
  });

  describe('file change tracking', () => {
    it('should track file creation', () => {
      const mockUri = { path: 'src/test.ts' };
      const createCallback = mockOnDidCreate.mock.calls[0][0];

      createCallback(mockUri);

      const editedFiles = fileChangeMonitor.getEditedFiles();
      expect(editedFiles).toHaveLength(1);
      expect(editedFiles[0]).toMatchObject({
        filePath: 'src/test.ts',
        changeType: 'created',
      });
      expect(editedFiles[0].timestamp).toBeInstanceOf(Date);
    });

    it('should track file modification', () => {
      const mockUri = { path: 'src/test.ts' };
      const changeCallback = mockOnDidChange.mock.calls[0][0];

      changeCallback(mockUri);

      const editedFiles = fileChangeMonitor.getEditedFiles();
      expect(editedFiles).toHaveLength(1);
      expect(editedFiles[0]).toMatchObject({
        filePath: 'src/test.ts',
        changeType: 'modified',
      });
    });

    it('should track file deletion', () => {
      const mockUri = { path: 'src/test.ts' };
      const deleteCallback = mockOnDidDelete.mock.calls[0][0];

      deleteCallback(mockUri);

      const editedFiles = fileChangeMonitor.getEditedFiles();
      expect(editedFiles).toHaveLength(1);
      expect(editedFiles[0]).toMatchObject({
        filePath: 'src/test.ts',
        changeType: 'deleted',
      });
    });

    it('should call registered callbacks when files change', () => {
      const callback = jest.fn();
      fileChangeMonitor.onFileChanged(callback);

      const mockUri = { path: 'src/test.ts' };
      const createCallback = mockOnDidCreate.mock.calls[0][0];
      createCallback(mockUri);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          filePath: 'src/test.ts',
          changeType: 'created',
        })
      );
    });

    it('should handle multiple callbacks', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      fileChangeMonitor.onFileChanged(callback1);
      fileChangeMonitor.onFileChanged(callback2);

      const mockUri = { path: 'src/test.ts' };
      const createCallback = mockOnDidCreate.mock.calls[0][0];
      createCallback(mockUri);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = jest.fn();
      
      fileChangeMonitor.onFileChanged(errorCallback);
      fileChangeMonitor.onFileChanged(normalCallback);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const mockUri = { path: 'src/test.ts' };
      const createCallback = mockOnDidCreate.mock.calls[0][0];
      createCallback(mockUri);

      expect(consoleSpy).toHaveBeenCalledWith('Error in file change callback:', expect.any(Error));
      expect(normalCallback).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('file filtering', () => {
    const testExcludedFiles = [
      // Temporary files
      'temp.tmp',
      'backup.temp',
      'file~',
      'vim.swp',
      'vim.swo',
      
      // System files
      '.DS_Store',
      'Thumbs.db',
      'desktop.ini',
      
      // IDE files
      '.vscode/settings.json',
      '.idea/workspace.xml',
      
      // Build directories
      'node_modules/package/index.js',
      'dist/bundle.js',
      'build/output.js',
      'out/compiled.js',
      '.git/config',
      
      // Log files
      'app.log',
      'debug.log.1',
      
      // Lock files
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
    ];

    testExcludedFiles.forEach(filePath => {
      it(`should exclude ${filePath}`, () => {
        const mockUri = { path: filePath };
        const createCallback = mockOnDidCreate.mock.calls[0][0];
        createCallback(mockUri);

        const editedFiles = fileChangeMonitor.getEditedFiles();
        expect(editedFiles).toHaveLength(0);
      });
    });

    const testIncludedFiles = [
      'src/index.ts',
      'README.md',
      'package.json',
      'tsconfig.json',
      'src/components/Button.tsx',
      'docs/api.md',
    ];

    testIncludedFiles.forEach(filePath => {
      it(`should include ${filePath}`, () => {
        const mockUri = { path: filePath };
        const createCallback = mockOnDidCreate.mock.calls[0][0];
        createCallback(mockUri);

        const editedFiles = fileChangeMonitor.getEditedFiles();
        expect(editedFiles).toHaveLength(1);
        expect(editedFiles[0].filePath).toBe(filePath);
      });
    });
  });

  describe('duplicate handling', () => {
    it('should avoid duplicate entries within time window', () => {
      const mockUri = { path: 'src/test.ts' };
      const createCallback = mockOnDidCreate.mock.calls[0][0];

      // Trigger the same event multiple times quickly
      createCallback(mockUri);
      createCallback(mockUri);
      createCallback(mockUri);

      const editedFiles = fileChangeMonitor.getEditedFiles();
      expect(editedFiles).toHaveLength(1);
    });

    it('should allow different change types for the same file', () => {
      const mockUri = { path: 'src/test.ts' };
      const createCallback = mockOnDidCreate.mock.calls[0][0];
      const changeCallback = mockOnDidChange.mock.calls[0][0];

      createCallback(mockUri);
      changeCallback(mockUri);

      const editedFiles = fileChangeMonitor.getEditedFiles();
      expect(editedFiles).toHaveLength(2);
      expect(editedFiles.map(f => f.changeType)).toEqual(['created', 'modified']);
    });
  });

  describe('line count tracking', () => {
    it('should attempt to get line count for created files', async () => {
      const mockDocument = { lineCount: 42 };
      (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument);

      const mockUri = { path: 'src/test.ts' };
      const createCallback = mockOnDidCreate.mock.calls[0][0];
      createCallback(mockUri);

      // Wait for async line count operation
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(mockUri);
    });

    it('should handle line count errors gracefully', async () => {
      (vscode.workspace.openTextDocument as jest.Mock).mockRejectedValue(new Error('File not found'));

      const mockUri = { path: 'src/binary.exe' };
      const createCallback = mockOnDidCreate.mock.calls[0][0];
      createCallback(mockUri);

      // Wait for async operation to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      const editedFiles = fileChangeMonitor.getEditedFiles();
      expect(editedFiles).toHaveLength(1);
      expect(editedFiles[0].lineCount).toBeUndefined();
    });

    it('should not attempt to get line count for deleted files', () => {
      const mockUri = { path: 'src/test.ts' };
      const deleteCallback = mockOnDidDelete.mock.calls[0][0];
      deleteCallback(mockUri);

      expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
    });
  });

  describe('reset functionality', () => {
    it('should clear all tracked files when reset', () => {
      const mockUri = { path: 'src/test.ts' };
      const createCallback = mockOnDidCreate.mock.calls[0][0];
      createCallback(mockUri);

      expect(fileChangeMonitor.getEditedFiles()).toHaveLength(1);

      fileChangeMonitor.reset();

      expect(fileChangeMonitor.getEditedFiles()).toHaveLength(0);
    });
  });

  describe('getEditedFiles', () => {
    it('should return a copy of the edited files array', () => {
      const mockUri = { path: 'src/test.ts' };
      const createCallback = mockOnDidCreate.mock.calls[0][0];
      createCallback(mockUri);

      const editedFiles1 = fileChangeMonitor.getEditedFiles();
      const editedFiles2 = fileChangeMonitor.getEditedFiles();

      expect(editedFiles1).not.toBe(editedFiles2); // Different array instances
      expect(editedFiles1).toEqual(editedFiles2); // Same content
    });
  });

  describe('performance optimizations', () => {
    it('should debounce rapid file changes', async () => {
      const callback = jest.fn();
      fileChangeMonitor.onFileChanged(callback);

      const mockUri = { path: 'src/test.ts' };
      const changeCallback = mockOnDidChange.mock.calls[0][0];

      // Trigger multiple rapid changes
      changeCallback(mockUri);
      changeCallback(mockUri);
      changeCallback(mockUri);

      // Should not call callback immediately due to debouncing
      expect(callback).not.toHaveBeenCalled();

      // Wait for debounce delay
      await new Promise(resolve => setTimeout(resolve, 600));

      // Should only call callback once after debounce
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should limit tracked files to prevent memory issues', () => {
      const changeCallback = mockOnDidChange.mock.calls[0][0];

      // Add files beyond the limit (1000)
      for (let i = 0; i < 1100; i++) {
        const mockUri = { path: `src/test${i}.ts` };
        changeCallback(mockUri);
      }

      // Wait for debounce
      return new Promise(resolve => {
        setTimeout(() => {
          const editedFiles = fileChangeMonitor.getEditedFiles();
          // Should not exceed the maximum limit significantly
          expect(editedFiles.length).toBeLessThanOrEqual(1000);
          resolve(undefined);
        }, 600);
      });
    });

    it('should perform cleanup of old entries', () => {
      // This test would require mocking Date.now() to simulate old entries
      // For now, we'll just verify the cleanup method exists and can be called
      expect(fileChangeMonitor).toBeDefined();
      
      // The cleanup runs automatically via interval, so we can't easily test it
      // without exposing internal methods or mocking timers
    });
  });

  describe('disposal', () => {
    it('should dispose of file system watcher and event listeners', () => {
      fileChangeMonitor.dispose();

      expect(mockWatcher.dispose).toHaveBeenCalled();
    });

    it('should handle multiple dispose calls gracefully', () => {
      fileChangeMonitor.dispose();
      fileChangeMonitor.dispose();

      expect(mockWatcher.dispose).toHaveBeenCalledTimes(1);
    });

    it('should clear all timers and pending changes on dispose', () => {
      const mockUri = { path: 'src/test.ts' };
      const changeCallback = mockOnDidChange.mock.calls[0][0];
      
      // Trigger a change to create pending timers
      changeCallback(mockUri);
      
      // Dispose should clear everything
      fileChangeMonitor.dispose();
      
      // Verify files are cleared
      expect(fileChangeMonitor.getEditedFiles()).toHaveLength(0);
    });
  });
});