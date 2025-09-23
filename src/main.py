import os
import signal
import subprocess
import sys
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, wait


class MonoRepoLauncher:
    """
    Mais pourquoi faire ça ?
       Pour appliquer le multi-threading
    Est-ce nécessaire et plus efficace que lancer indépendemment les deux serveurs ou avec Docker ?
       Ni l'un ni l'autre
    Donc c'est indispensable !

    """

    def __init__(self):
        root = Path(__file__).resolve().parent
        self.targets = [root / "backend" / "api.py", root / "frontend" / "app.py"]
        self.processes = []

    def run_script(self, path: Path):
        p = subprocess.Popen(
            [sys.executable, "-u", str(path)],
            cwd=path.parent,
            env={**os.environ, "PYTHONUNBUFFERED": "1"},
        )
        self.processes.append(p)
        return p.wait()

    def stop(self, *_):
        for p in self.processes:
            if p.poll() is None:
                p.terminate()
        for p in self.processes:
            try:
                p.wait(timeout=3)
            except subprocess.TimeoutExpired:
                p.kill()

    def start(self):
        signal.signal(signal.SIGINT, self.stop)
        signal.signal(signal.SIGTERM, self.stop)
        with ThreadPoolExecutor(max_workers=len(self.targets)) as pool:
            futures = [pool.submit(self.run_script, t) for t in self.targets]
            wait(futures)


if __name__ == "__main__":
    MonoRepoLauncher().start()
