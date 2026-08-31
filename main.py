from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import PyPDF2
import io
import pytesseract
from pdf2image import convert_from_bytes
import traceback

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/extract-pdf")
async def extract_pdf(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        
        # Phase 1: Digital Text
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(contents))
        extracted_text = ""
        for page in pdf_reader.pages:
            text = page.extract_text()
            if text:
                extracted_text += text + "\n"

        extracted_text = extracted_text.strip()

        # Phase 2: OCR Fallback
        if len(extracted_text) < 50:
            images = convert_from_bytes(contents)
            ocr_text = ""
            for img in images:
                ocr_text += pytesseract.image_to_string(img) + "\n"
            extracted_text = ocr_text.strip()

        if len(extracted_text) < 10:
            return JSONResponse(status_code=400, content={"error": "OCR completed, but the PDF appears to be a blank image with no readable words."})

        return {"filename": file.filename, "text": extracted_text}
        
    except Exception as e:
        # If Poppler or Tesseract crash, this catches the EXACT reason
        error_msg = str(e)
        if "poppler" in error_msg.lower():
            error_msg = "Arch Linux Error: Poppler is not in PATH or missing 'poppler-data'."
        elif "tesseract" in error_msg.lower():
            error_msg = "Arch Linux Error: Tesseract OCR is not installed correctly."
            
        print(f"CRITICAL CRASH: {traceback.format_exc()}")
        return JSONResponse(status_code=500, content={"error": error_msg})
