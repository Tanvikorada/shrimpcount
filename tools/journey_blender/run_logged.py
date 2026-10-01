# Runs build.py with Python's output sent to a file: the Store build of Blender runs detached, with no console.
#   blender-launcher -b -y --factory-startup -P run_logged.py -- --pylog LOG [build.py args]
import os, sys, runpy, traceback
argv = sys.argv[sys.argv.index("--") + 1:]
log = argv[argv.index("--pylog") + 1]
sys.stdout = sys.stderr = open(log, "a", buffering=1)
try:
    runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), "build.py"), run_name="__main__")
except Exception:
    traceback.print_exc()
print("build.py finished", flush=True)
