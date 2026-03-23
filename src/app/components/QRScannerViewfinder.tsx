import { useEffect, useState, useRef, useCallback } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { Camera, AlertCircle, Upload } from "lucide-react";

interface QRScannerViewfinderProps {
  onScan?: (data: string) => void;
  scanning?: boolean;
  success?: boolean;
}

export function QRScannerViewfinder({ onScan, scanning = true, success = false }: QRScannerViewfinderProps) {
  const [cornersVisible, setCornersVisible] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<"pending" | "granted" | "denied">("pending");
  const [isInitializing, setIsInitializing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const hasScanned = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setCornersVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (scanning) {
      hasScanned.current = false;
    }
  }, [scanning]);

  const stopCamera = useCallback(() => {
    if (controlsRef.current) {
      try { controlsRef.current.stop(); } catch (_) {}
      controlsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !onScan || hasScanned.current) return;
    event.target.value = "";
    try {
      const codeReader = new BrowserQRCodeReader();
      const objectUrl = URL.createObjectURL(file);
      const result = await codeReader.decodeFromImageUrl(objectUrl);
      URL.revokeObjectURL(objectUrl);
      if (result && !hasScanned.current) {
        hasScanned.current = true;
        onScan(result.getText());
      }
    } catch (err) {
      console.error("Failed to read QR from image:", err);
      alert("No QR code found in the image. Please try another image.");
    }
  };

  const requestCameraAccess = async () => {
    if (!scanning || success || isInitializing) return;

    if (!window.isSecureContext) {
      setCameraError("Camera requires a secure connection (HTTPS). Please upload a QR code image instead.");
      setPermissionState("denied");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera API not supported in this browser. Please upload a QR code image instead.");
      setPermissionState("denied");
      return;
    }

    setIsInitializing(true);
    setCameraError(null);
    stopCamera();

    const startWithStream = async (stream: MediaStream) => {
      streamRef.current = stream;

      if (!videoRef.current) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      if (!videoRef.current) {
        stopCamera();
        setCameraError("Video element not ready. Please try again.");
        setPermissionState("denied");
        setIsInitializing(false);
        return;
      }

      videoRef.current.srcObject = stream;

      await new Promise<void>((resolve) => {
        const video = videoRef.current!;
        if (video.readyState >= 2) { resolve(); return; }
        video.onloadedmetadata = () => resolve();
        setTimeout(() => resolve(), 2000);
      });

      await videoRef.current.play();

      // FIX: use decodeFromStream instead of decodeFromVideoElement
      // decodeFromVideoElement tries to manage its own stream internally,
      // conflicting with the stream we already attached to the video element.
      // decodeFromStream receives our stream directly and just decodes from it.
      const codeReader = new BrowserQRCodeReader();
      const controls = await codeReader.decodeFromStream(
        stream,
        videoRef.current,
        (result, error) => {
          if (result && !hasScanned.current && onScan) {
            hasScanned.current = true;
            onScan(result.getText());
          }
          if (error && error.name !== "NotFoundException") {
            console.warn("QR decode error:", error);
          }
        }
      );

      controlsRef.current = controls;
      setPermissionState("granted");
      setIsInitializing(false);
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      await startWithStream(stream);
    } catch (err: any) {
      console.error("Camera error:", err);

      // Retry with bare minimum constraints if camera was overconstrained
      if (err.name === "OverconstrainedError") {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
          await startWithStream(fallbackStream);
          return;
        } catch (fallbackErr: any) {
          console.error("Fallback camera also failed:", fallbackErr);
        }
      }

      stopCamera();
      setPermissionState("denied");
      setIsInitializing(false);

      const errorMessages: Record<string, string> = {
        NotAllowedError:       "Camera access denied. Please allow camera access in your browser settings.",
        PermissionDeniedError: "Camera access denied. Please allow camera access in your browser settings.",
        NotFoundError:         "No camera found on this device.",
        NotReadableError:      "Camera is already in use by another app or tab. Close other apps and try again.",
        NotSupportedError:     "Camera not supported in this browser.",
        SecurityError:         "Camera blocked. Ensure the page is served over HTTPS.",
        OverconstrainedError:  "Camera could not be started. Please try uploading an image.",
      };

      setCameraError(errorMessages[err.name] ?? "Camera unavailable. You can upload a QR code image instead.");
    }
  };

  const cornerColor = success ? "var(--accent-cyan)" : "var(--tc-border)";
  const cornerGlow  = success ? "0 0 12px var(--accent-cyan)" : "none";

  const cornerStyle = (position: string): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute", width: "48px", height: "48px",
      borderColor: cornerColor, boxShadow: cornerGlow,
      opacity: cornersVisible ? 1 : 0,
      transform: cornersVisible ? "scale(1)" : "scale(1.1)",
      transition: "all 300ms ease-out, border-color 150ms ease-out, box-shadow 150ms ease-out",
      zIndex: 10,
    };
    switch (position) {
      case "tl": return { ...base, top: 0, left: 0,     borderTop:    `3px solid ${cornerColor}`, borderLeft:  `3px solid ${cornerColor}` };
      case "tr": return { ...base, top: 0, right: 0,    borderTop:    `3px solid ${cornerColor}`, borderRight: `3px solid ${cornerColor}` };
      case "bl": return { ...base, bottom: 0, left: 0,  borderBottom: `3px solid ${cornerColor}`, borderLeft:  `3px solid ${cornerColor}` };
      case "br": return { ...base, bottom: 0, right: 0, borderBottom: `3px solid ${cornerColor}`, borderRight: `3px solid ${cornerColor}` };
      default:   return base;
    }
  };

  return (
    <div className="relative w-[320px] h-[320px] md:w-[400px] md:h-[400px]">
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />

      <div
        className="absolute inset-0 overflow-hidden rounded-[4px]"
        style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--tc-border)" }}
      >
        {/* Video is always rendered so the ref is always available when the stream starts */}
        <video
          ref={videoRef}
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            display: permissionState === "granted" && !cameraError ? "block" : "none",
          }}
          playsInline
          muted
        />

        {/* Permission request overlay */}
        {permissionState === "pending" && !cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 gap-3">
            <button
              onClick={requestCameraAccess}
              disabled={isInitializing}
              className="flex flex-col items-center gap-3 px-6 py-4 rounded-[4px] transition-all duration-200"
              style={{
                border: "1px solid var(--tc-border)", backgroundColor: "var(--bg-surface)",
                color: "var(--text-primary)", cursor: isInitializing ? "wait" : "pointer",
                opacity: isInitializing ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isInitializing) {
                  e.currentTarget.style.borderColor = "var(--accent-cyan)";
                  e.currentTarget.style.backgroundColor = "rgba(0, 212, 255, 0.05)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--tc-border)";
                e.currentTarget.style.backgroundColor = "var(--bg-surface)";
              }}
            >
              <Camera size={32} style={{ color: isInitializing ? "var(--text-dim)" : "var(--accent-cyan)", opacity: isInitializing ? 0.5 : 1 }} />
              <div className="text-center">
                <p className="font-mono-ibm mb-1" style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                  {isInitializing ? "Starting camera..." : "Enable Camera"}
                </p>
                <p className="font-mono-ibm" style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                  {isInitializing ? "Allow camera access in browser popup" : "Click to scan with camera"}
                </p>
              </div>
            </button>

            <div className="font-mono-ibm" style={{ fontSize: "11px", color: "var(--text-dim)" }}>or</div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-[4px] transition-all duration-200 cursor-pointer"
              style={{ border: "1px solid var(--tc-border)", backgroundColor: "var(--bg-surface)", color: "var(--text-secondary)" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent-cyan)"; e.currentTarget.style.color = "var(--accent-cyan)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--tc-border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
            >
              <Upload size={16} />
              <span className="font-mono-ibm" style={{ fontSize: "12px" }}>Upload QR Image</span>
            </button>
          </div>
        )}

        {/* Error overlay */}
        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-4">
            <AlertCircle size={32} style={{ color: "var(--error-red)" }} />
            <p className="font-mono-ibm" style={{ fontSize: "13px", color: "var(--error-red)" }}>{cameraError}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 rounded-[4px] transition-colors duration-200 cursor-pointer"
                style={{ border: "1px solid var(--accent-cyan)", backgroundColor: "rgba(0, 212, 255, 0.05)", color: "var(--accent-cyan)" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(0, 212, 255, 0.1)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(0, 212, 255, 0.05)"; }}
              >
                <Upload size={16} />
                <span className="font-mono-ibm" style={{ fontSize: "12px" }}>Upload QR Image</span>
              </button>
              <button
                onClick={() => { setCameraError(null); setPermissionState("pending"); }}
                className="flex items-center gap-2 px-4 py-2 rounded-[4px] transition-colors duration-200 cursor-pointer"
                style={{ border: "1px solid var(--tc-border)", backgroundColor: "var(--bg-surface)", color: "var(--text-secondary)" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent-cyan)"; e.currentTarget.style.color = "var(--accent-cyan)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--tc-border)"; e.currentTarget.style.color = "var(--text-secondary)"; }}
              >
                <span className="font-mono-ibm" style={{ fontSize: "12px" }}>Try Camera Again</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={cornerStyle("tl")} />
      <div style={cornerStyle("tr")} />
      <div style={cornerStyle("bl")} />
      <div style={cornerStyle("br")} />

      {scanning && !success && !cameraError && permissionState === "granted" && (
        <div
          className="absolute left-[12px] right-[12px] h-[2px] animate-scan-line"
          style={{ background: `linear-gradient(90deg, transparent, var(--accent-cyan), transparent)`, opacity: 0.6, zIndex: 10, pointerEvents: "none" }}
        />
      )}

      {permissionState === "granted" && !cameraError && (
        <>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 10 }}>
            <div className="w-[2px] h-[16px]" style={{ backgroundColor: "var(--text-dim)", opacity: 0.3 }} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 10 }}>
            <div className="w-[16px] h-[2px]" style={{ backgroundColor: "var(--text-dim)", opacity: 0.3 }} />
          </div>
        </>
      )}
    </div>
  );
}
