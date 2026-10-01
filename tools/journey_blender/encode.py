"""Encode the rendered journey frames into the landing films.

    python tools/journey_blender/encode.py FRAMES_DIR landing/media

journey.mp4     desktop, 16:9
journey-sm.mp4  phones, a 9:16 crop from the middle of the frame
journey-poster.jpg  the first frame
Every frame is a keyframe, so any frame a scroll asks for decodes on its own, at once.
"""
import glob, os, shutil, subprocess, sys, tempfile
import imageio_ffmpeg
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
FF = imageio_ffmpeg.get_ffmpeg_exe()
frames = sorted(f for f in glob.glob(os.path.join(src, "f*.jpg")) if os.path.getsize(f) > 0)
tmp = tempfile.mkdtemp()
for i, f in enumerate(frames): shutil.copy(f, os.path.join(tmp, "%05d.jpg" % i))
print(len(frames), "frames")
Image.open(frames[0]).save(os.path.join(out, "journey-poster.jpg"), quality=84)

def enc(name, vf, crf, gop):
    p = os.path.join(out, name)
    subprocess.run([FF, "-y", "-loglevel", "error", "-framerate", "24", "-i", os.path.join(tmp, "%05d.jpg"), "-vf", vf,
                    "-c:v", "libx264", "-preset", "slow", "-tune", "fastdecode", "-pix_fmt", "yuv420p", "-crf", str(crf),
                    "-g", str(gop), "-bf", "0", "-an", "-movflags", "+faststart", p], check=True)
    print(name, os.path.getsize(p) // 1024, "KB")

enc("journey.mp4", "scale=1440:-2:flags=lanczos", 24, 1)
enc("journey-sm.mp4", "crop=506:900:547:0,scale=540:960:flags=lanczos", 25, 1)
shutil.rmtree(tmp)
