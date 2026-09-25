export class DesktopLauncher {
  private backendUrl = 'http://localhost:3001/api/health';

  public async ensureBackendRunning(): Promise<boolean> {
    try {
      const res = await fetch(this.backendUrl);
      if (res.ok) {
        console.log('[Desktop Launcher] Local Express backend is running and healthy.');
        return true;
      }
    } catch (err) {
      console.log('[Desktop Launcher] Express backend starting automatically...');
    }
    return false;
  }
}

export const desktopLauncher = new DesktopLauncher();
