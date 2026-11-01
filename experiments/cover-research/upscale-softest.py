# Upscales the 10 softest pick covers (work/softest10.json) to 2x with EDSR and writes
# original + 2x pairs to upscaled/, the input to build-compare.mjs and build-blind.mjs.
#
# Setup (about 270 MB, kept outside the app; not a project dependency):
#   python3 -m venv <somewhere>/srenv
#   <somewhere>/srenv/bin/pip install "opencv-contrib-python-headless==4.10.0.84"
#   curl -L -o scratchpad/cover-research/work/models/EDSR_x2.pb \
#     https://raw.githubusercontent.com/Saafke/EDSR_Tensorflow/master/models/EDSR_x2.pb
# EDSR weights and OpenCV are both Apache-2.0. About 90 s per 300x500 cover on 2 CPU cores.
# Usage (from the repo root): <somewhere>/srenv/bin/python -I scratchpad/cover-research/upscale-softest.py
import json, os, shutil, time, cv2

WORK = "scratchpad/cover-research/work"
OUT = "scratchpad/cover-research/upscaled"
os.makedirs(OUT, exist_ok=True)

sr = cv2.dnn_superres.DnnSuperResImpl_create()
sr.readModel(f"{WORK}/models/EDSR_x2.pb")
sr.setModel("edsr", 2)

for b in json.load(open(f"{WORK}/softest10.json")):
    img = cv2.imread(b["file"], cv2.IMREAD_COLOR)
    t = time.time()
    up = sr.upsample(img)
    shutil.copyfile(b["file"], f"{OUT}/{b['name']}-original.jpg")
    cv2.imwrite(f"{OUT}/{b['name']}-2x.png", up)
    print(f"{b['name']}: {img.shape[1]}x{img.shape[0]} -> {up.shape[1]}x{up.shape[0]} in {time.time() - t:.1f}s", flush=True)
