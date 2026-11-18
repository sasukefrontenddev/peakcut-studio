import { spawn } from 'node:child_process';

// Keep processing available behind the lock screen, while allowing the display to sleep.
// macOS releases this assertion when the engine process exits.
export function keepEngineAwake({platform=process.platform,pid=process.pid,launch=spawn}={}) {
  if (platform !== 'darwin') return {stop(){}};
  const child=launch('/usr/bin/caffeinate',['-i','-w',String(pid)],{stdio:'ignore'});
  child.on('error',()=>console.warn('PeakCut could not prevent idle sleep. Keep the Mac awake while recording.'));
  child.unref();
  return {stop(){child.kill();}};
}
