# Upscales the design samples in samples/ to 2x with EDSR into samples-2x/, keeping
# filenames (JPEG quality 95). 07 is already large, so it's copied across unchanged.
# Setup: see upscale-softest.py.
# Usage (from the repo root): <somewhere>/srenv/bin/python -I scratchpad/cover-research/upscale-samples.py
import os, shutil, time, cv2

SRC = "scratchpad/cover-research/samples"
DST = "scratchpad/cover-research/samples-2x"
MODEL = "scratchpad/cover-research/work/models/EDSR_x2.pb"
SKIP = "07-"
os.makedirs(DST, exist_ok=True)

sr = cv2.dnn_superres.DnnSuperResImpl_create()
sr.readModel(MODEL)
sr.setModel("edsr", 2)

for f in sorted(os.listdir(SRC)):
    if not f.endswith(".jpg"):
        continue
    if f.startswith(SKIP):
        shutil.copyfile(os.path.join(SRC, f), os.path.join(DST, f))
        continue
    img = cv2.imread(os.path.join(SRC, f), cv2.IMREAD_COLOR)
    t = time.time()
    up = sr.upsample(img)
    cv2.imwrite(os.path.join(DST, f), up, [cv2.IMWRITE_JPEG_QUALITY, 95])
    print(f"{f}: {img.shape[1]}x{img.shape[0]} -> {up.shape[1]}x{up.shape[0]} in {time.time() - t:.0f}s", flush=True)
