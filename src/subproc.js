import Gio from 'gi://Gio';

// make use of the promisify wrapper to create a promise that can be awaited
// and automatically call the finish function as part of the resolve
Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async', 'communicate_utf8_finish');

export async function runCommandAsync (command) {
  // create a new subprocess for the command, which can include parameters in
  // subsequent array elements
  const proc = new Gio.Subprocess({
    argv: command,
    flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
  });

  // start the process (in my testing the command was not run until init called)
  proc.init(null);

  // await will return once the promise is settled and assuming resolved will
  // also call the finish method and return the output requested by flags above
  const [stdout, stderr] = await proc.communicate_utf8_async(null, null);

  // check if any problem based on exit status of command
  const wasNotSuccessful = proc.get_successful() === false;

  // if sensors command was run, it will report errors to stderr but still
  // have a zero return value so proc.get_successful is not definitive
  const hasError = stderr && stderr.length > 0;

  // just log a warning as the nature of the error might not prevent all output
  // and other commands (like hddtemp) may execute successfully
  if (hasError) {
    console.warn(stderr);
  }

  // provide the output of the command to the caller and an indication if either
  // the command was not successful or had reported something to stderr
  return [stdout, wasNotSuccessful || hasError];
}
