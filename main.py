from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import numpy as np
from ultralytics import YOLO
from tensorflow.keras.models import load_model

app = FastAPI()

# Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load models
yolo_model = YOLO("yolov8n.pt")
classifier = load_model("model.h5")

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    image = Image.open(file.file).convert("RGB")

    # YOLO detection
    results = yolo_model(image)
    boxes = results[0].boxes.xyxy

    if boxes is None or len(boxes) == 0:
        return {"error": "No lesion detected"}

    # Crop detected area
    x1, y1, x2, y2 = map(int, boxes[0])
    cropped = image.crop((x1, y1, x2, y2))

    # Preprocess
    cropped = cropped.resize((224, 224))
    img_array = np.array(cropped) / 255.0
    img_array = np.expand_dims(img_array, axis=0)

    # Predict
    pred = classifier.predict(img_array)[0]

    result = "Malignant" if pred[1] > pred[0] else "Benign"
    confidence = float(max(pred))

    return {
        "prediction": result,
        "confidence": round(confidence * 100, 2)
    }