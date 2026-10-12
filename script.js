
import {
    FaceDetector,
    FilesetResolver
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

// ==================================================
// SECTION 1: FIND THE HTML ELEMENTS
// ==================================================

const video = document.getElementById("cameraVideo");
const canvas = document.getElementById("photoCanvas");
const context = canvas.getContext("2d");

const overlay = document.getElementById("faceOverlay");
const overlayContext = overlay.getContext("2d");
const photoStage = document.querySelector(".photo-stage");

const startButton = document.getElementById("startCamera");
const captureButton = document.getElementById("capturePhoto");
const stopButton = document.getElementById("stopCamera");

const photoInput = document.getElementById("photoInput");
const placeholder = document.getElementById("placeholder");
const cameraStatus = document.getElementById("cameraStatus");

const colorPreview = document.getElementById("colorPreview");
const colorName = document.getElementById("colorName");
const rgbValue = document.getElementById("rgbValue");
const hexValue = document.getElementById("hexValue");
const spectrumMarker = document.getElementById("spectrumMarker");

const successPopup = document.getElementById("successPopup");
const closePopup = document.getElementById("closePopup");
const popupDone = document.getElementById("popupDone");

const popupLevelNumber = document.getElementById("popupLevelNumber");
const popupColorSwatch = document.getElementById("popupColorSwatch");
const popupColorLevel = document.getElementById("popupColorLevel");
const popupSpectrumMarker = document.getElementById("popupSpectrumMarker");

const levelSound = new Audio("./nigaaa.mp3");
let levelSoundPlayed = false;


// ==================================================
// SECTION 2: APPLICATION VARIABLES
// ==================================================

let cameraStream = null;
let photoReady = false;
let photoVersion = 0;


// ==================================================
// SECTION 3: LOAD THE MEDIAPIPE FACE DETECTOR
// ==================================================

const detectorReady = (async () => {
    try {
        cameraStatus.textContent = "Loading face detector...";

        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );

        const detector = await FaceDetector.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath:
                    "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"
            },
            runningMode: "IMAGE",
            minDetectionConfidence: 0.5
        });

        cameraStatus.textContent = "Face detector ready.";

        return detector;

    } catch (error) {
        console.error("Face detector loading error:", error);

        cameraStatus.textContent =
            "Face detector could not load. Check your internet connection.";

        return null;
    }
})();


// ==================================================
// SECTION 4: DISPLAY A CAPTURED OR UPLOADED PHOTO
// ==================================================


function showPhoto(source, width, height) {

    // Reset the sound for the new photo
    levelSoundPlayed = false;

    if (!width || !height) {
        cameraStatus.textContent = "The selected photo is invalid.";
        return;
    }

    // Keep the rest of your existing code below


    // Reduce very large images to save memory.
    const scale = Math.min(1, 1600 / width, 1200 / height);

    const finalWidth = Math.max(1, Math.round(width * scale));
    const finalHeight = Math.max(1, Math.round(height * scale));

    photoVersion++;
    const currentVersion = photoVersion;

    canvas.width = finalWidth;
    canvas.height = finalHeight;

    overlay.width = finalWidth;
    overlay.height = finalHeight;

    context.drawImage(source, 0, 0, finalWidth, finalHeight);
    overlayContext.clearRect(0, 0, finalWidth, finalHeight);

    photoStage.style.display = "block";
    placeholder.style.display = "none";

    photoReady = true;
    successPopup.hidden = true;

    cameraStatus.textContent = "Scanning for a face...";

    detectFace(currentVersion);
}


// ==================================================
// SECTION 5: DETECT THE FACE AND SAMPLE ITS COLOR
// ==================================================

async function detectFace(currentVersion) {
    const faceDetector = await detectorReady;

    // Ignore results if a newer photo has been selected.
    if (currentVersion !== photoVersion || !photoReady) {
        return;
    }

    if (!faceDetector) {
        cameraStatus.textContent =
            "Face detection unavailable. Check your internet connection.";
        return;
    }

    try {
        const result = faceDetector.detect(canvas);

        if (currentVersion !== photoVersion) return;

        const faces = result.detections;

        // Display an error if no face is detected.
        if (!faces || faces.length === 0) {
            overlayContext.clearRect(0, 0, overlay.width, overlay.height);
            successPopup.hidden = true;
            cameraStatus.textContent = "Face not found.";
            return;
        }

        // Use the first detected face.
        const box = faces[0].boundingBox;

        // Draw a glowing rectangle around the face.
        overlayContext.strokeStyle = "#22d3ee";
        overlayContext.lineWidth = Math.max(2, canvas.width * 0.003);
        overlayContext.shadowColor = "#22d3ee";
        overlayContext.shadowBlur = 14;

        overlayContext.strokeRect(
            box.originX,
            box.originY,
            box.width,
            box.height
        );

        overlayContext.shadowBlur = 0;

        // Estimate color using two regions inside the face box.
        const leftSample = sampleRegion(
            box.originX + box.width * 0.18,
            box.originY + box.height * 0.40,
            box.width * 0.24,
            box.height * 0.18
        );

        const rightSample = sampleRegion(
            box.originX + box.width * 0.58,
            box.originY + box.height * 0.40,
            box.width * 0.24,
            box.height * 0.18
        );

        if (!leftSample || !rightSample) {
            cameraStatus.textContent =
                "Face found, but color sampling failed.";
            return;
        }

        // Average the two color samples.
        const averageColor = [
            Math.round((leftSample[0] + rightSample[0]) / 2),
            Math.round((leftSample[1] + rightSample[1]) / 2),
            Math.round((leftSample[2] + rightSample[2]) / 2)
        ];

        displayColor(averageColor, "Approximate face-area color");
        showColorSuccess(averageColor);

        cameraStatus.textContent = "Face detected! Color scan complete.";

    } catch (error) {
        console.error("Face detection error:", error);

        cameraStatus.textContent =
            "Face scan failed. Try another photo.";
    }
}


// ==================================================
// SECTION 6: CALCULATE THE AVERAGE COLOR OF A REGION
// ==================================================

function sampleRegion(x, y, width, height) {
    const startX = Math.max(0, Math.floor(x));
    const startY = Math.max(0, Math.floor(y));

    const endX = Math.min(canvas.width, Math.ceil(x + width));
    const endY = Math.min(canvas.height, Math.ceil(y + height));

    const regionWidth = endX - startX;
    const regionHeight = endY - startY;

    if (regionWidth <= 0 || regionHeight <= 0) {
        return null;
    }

    try {
        const pixels = context.getImageData(
            startX,
            startY,
            regionWidth,
            regionHeight
        ).data;

        let red = 0;
        let green = 0;
        let blue = 0;
        let count = 0;

        // Process every fourth pixel to reduce computation.
        for (let i = 0; i < pixels.length; i += 16) {
            red += pixels[i];
            green += pixels[i + 1];
            blue += pixels[i + 2];
            count++;
        }

        if (count === 0) return null;

        return [
            Math.round(red / count),
            Math.round(green / count),
            Math.round(blue / count)
        ];

    } catch (error) {
        console.error("Color sampling error:", error);
        return null;
    }
}


// ==================================================
// SECTION 7: CONVERT RGB TO HEX AND CALCULATE BRIGHTNESS
// ==================================================

function getHex(rgb) {
    return "#" + rgb
        .map(value => value.toString(16).padStart(2, "0"))
        .join("");
}

function getBrightness([red, green, blue]) {
    return (red * 299 + green * 587 + blue * 114) / 1000;
}

function getSpectrumPosition(rgb) {
    const brightness = getBrightness(rgb);

    // 0% means lighter; 100% means darker.
    return 100 - (brightness / 255) * 100;
}


// ==================================================
// SECTION 8: UPDATE THE MAIN COLOR EXPLORER
// ==================================================

function displayColor(rgb, label) {
    const hex = getHex(rgb);
    const position = getSpectrumPosition(rgb);

    colorPreview.style.backgroundColor = hex;
    colorName.textContent = label;

    rgbValue.textContent = `RGB: ${rgb.join(", ")}`;
    hexValue.textContent = `HEX: ${hex.toUpperCase()}`;

    spectrumMarker.style.left = `${position}%`;
}


// ==================================================
// SECTION 9: SHOW THE COLOR LEVEL FROM 1 TO 100
// ==================================================

function showColorSuccess(rgb) {
    const position = getSpectrumPosition(rgb);

    // Convert brightness position into a level from 1 to 100.
    const level = Math.max(
        1,
        Math.min(100, Math.round(position * 0.99) + 1)
    );

if (level > 50 && !levelSoundPlayed) {
    levelSoundPlayed = true;

    levelSound.currentTime = 0;

    levelSound.play().catch(error => {
        levelSoundPlayed = false;
        console.log("Audio playback failed:", error);
    });
}

    let description;

    if (level <= 33) {
        description = "Light Color Level";
    } else if (level <= 66) {
        description = "Medium Color Level";
    } else {
        description = "Dark Color Level";
    }

    // Update the large number and description.
    popupLevelNumber.textContent = level;
    popupColorLevel.textContent = description;

    // Show the color swatch and spectrum marker.
    popupColorSwatch.style.backgroundColor = getHex(rgb);
    popupSpectrumMarker.style.left = `${position}%`;

    // Display the popup.
    successPopup.hidden = false;
}


// ==================================================
// SECTION 10: CLOSE THE POPUP
// ==================================================

function closeColorPopup() {
    successPopup.hidden = true;
}

// Both close buttons are handled here.
successPopup.addEventListener("click", event => {
    if (event.target.closest("#closePopup, #popupDone")) {
        closeColorPopup();
        return;
    }

    // Close by clicking the dark backdrop.
    if (event.target === successPopup) {
        closeColorPopup();
    }
});

// Close with the Escape key.
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !successPopup.hidden) {
        closeColorPopup();
    }
});


// ==================================================
// SECTION 11: START THE WEBCAM
// ==================================================

startButton.addEventListener("click", async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
        cameraStatus.textContent =
            "Camera unavailable. Open the website using VS Code Live Server.";
        return;
    }

    startButton.disabled = true;
    cameraStatus.textContent = "Requesting camera access...";

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: false
        });

        cameraStream = stream;

        video.srcObject = cameraStream;
        video.style.display = "block";

        await video.play();

        captureButton.disabled = false;
        stopButton.disabled = false;

        cameraStatus.textContent =
            "Camera is on. Position your face and click Capture Photo.";

    } catch (error) {
        console.error("Camera error:", error);

        if (error.name === "NotAllowedError") {
            cameraStatus.textContent =
                "Camera permission denied. Allow access in Chrome settings.";
        } else if (error.name === "NotFoundError") {
            cameraStatus.textContent =
                "No camera found. Connect a webcam and try again.";
        } else {
            cameraStatus.textContent =
                "Could not start the camera. Check permissions and try again.";
        }

        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }

        video.srcObject = null;
        video.style.display = "none";

        startButton.disabled = false;
    }
});


// ==================================================
// SECTION 12: CAPTURE A PHOTO FROM THE WEBCAM
// ==================================================

captureButton.addEventListener("click", () => {
    if (!cameraStream || video.videoWidth === 0) {
        cameraStatus.textContent =
            "Camera is not ready yet. Please wait and try again.";
        return;
    }

    showPhoto(video, video.videoWidth, video.videoHeight);
});


// ==================================================
// SECTION 13: STOP THE WEBCAM
// ==================================================

stopButton.addEventListener("click", () => {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    video.srcObject = null;
    video.style.display = "none";

    startButton.disabled = false;
    captureButton.disabled = true;
    stopButton.disabled = true;

    cameraStatus.textContent = "Camera is off.";
});


// ==================================================
// SECTION 14: UPLOAD A PHOTO
// ==================================================

photoInput.addEventListener("change", event => {
    const file = event.target.files[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        cameraStatus.textContent = "Please choose an image file.";
        return;
    }

    cameraStatus.textContent = "Loading your photo...";

    const image = new Image();
    const imageURL = URL.createObjectURL(file);

    image.onload = () => {
        try {
            showPhoto(image, image.naturalWidth, image.naturalHeight);
        } catch (error) {
            console.error("Photo loading error:", error);
            cameraStatus.textContent = "Could not process that photo.";
        } finally {
            URL.revokeObjectURL(imageURL);
        }
    };

    image.onerror = () => {
        URL.revokeObjectURL(imageURL);
        cameraStatus.textContent = "Could not load that image.";
    };

    image.src = imageURL;
});


// ==================================================
// SECTION 15: CLICK A PIXEL TO EXPLORE ITS COLOR
// ==================================================

canvas.addEventListener("click", event => {
    if (!photoReady) return;

    const bounds = canvas.getBoundingClientRect();

    if (!bounds.width || !bounds.height) return;

    const x = Math.max(
        0,
        Math.min(
            canvas.width - 1,
            Math.floor(
                (event.clientX - bounds.left) *
                canvas.width / bounds.width
            )
        )
    );

    const y = Math.max(
        0,
        Math.min(
            canvas.height - 1,
            Math.floor(
                (event.clientY - bounds.top) *
                canvas.height / bounds.height
            )
        )
    );

    try {
        const pixel = context.getImageData(x, y, 1, 1).data;

        displayColor(
            [pixel[0], pixel[1], pixel[2]],
            "Selected pixel color"
        );

    } catch (error) {
        console.error("Pixel sampling error:", error);
        cameraStatus.textContent = "Could not sample that pixel.";
    }
});
