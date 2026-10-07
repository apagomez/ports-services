import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Save, CheckCircle2, ArrowLeft, Download } from "lucide-react";
import Papa from "papaparse";
import html2canvas from "html2canvas";
import { VesselData, VesselApplication } from "../types";
import fabLogo from "../assets/images/fab-logo.png";
import { getAccessToken } from "../services/googleSheetsService";
import { formatSystemDate } from "../utils/dateFormatter";
import { oklchToRgb } from "../utils/colorConverter";
import { normalizeTerminal, FAB_PORT_TERMINALS } from "../utils/terminalNormalizer";
import vesselsCsvFallback from "../../public/vessels_mock.csv?raw";

interface VesselEntryFormProps {
  onBack: () => void;
  onSubmitApp?: (
    app: Omit<VesselApplication, "id" | "createdAt" | "status"> & { id?: string },
  ) => void | Promise<void>;
  initialData?: Partial<VesselApplication>;
  isEditMode?: boolean;
  isAdmin?: boolean;
  authRole?: 'admin' | 'user' | 'checker' | 'approver';
  options?: {
    voyages: string[];
    types: string[];
    terminals: string[];
    origins: string[];
    usedControlNumbers?: string[];
  };
}

const parseDateString = (dateString?: string): Date | null => {
  if (!dateString) return null;
  const cleanStr = String(dateString).trim();
  if (!cleanStr) return null;

  // Try standard parsing first
  let d = new Date(cleanStr);
  if (!isNaN(d.getTime())) return d;

  // 1. ISO-like format: "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD HH:mm:ss" or with "T" and space, etc.
  const isoMatch = cleanStr.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const dVal = parseInt(isoMatch[3], 10);
    const h = isoMatch[4] ? parseInt(isoMatch[4], 10) : 0;
    const min = isoMatch[5] ? parseInt(isoMatch[5], 10) : 0;
    const sec = isoMatch[6] ? parseInt(isoMatch[6], 10) : 0;
    const parsed = new Date(y, m, dVal, h, min, sec);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // 2. Custom format: "MM-DD-YYYY HH:mm" or with slash (e.g. "06-02-2026 08:29" or "06/02/2026")
  const numericMatch = cleanStr.match(
    /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (numericMatch) {
    const m = parseInt(numericMatch[1], 10) - 1;
    const dVal = parseInt(numericMatch[2], 10);
    const y = parseInt(numericMatch[3], 10);
    const h = numericMatch[4] ? parseInt(numericMatch[4], 10) : 0;
    const min = numericMatch[5] ? parseInt(numericMatch[5], 10) : 0;
    const sec = numericMatch[6] ? parseInt(numericMatch[6], 10) : 0;
    const parsed = new Date(y, m, dVal, h, min, sec);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  // 3. Custom sheet format: "DD-MMM-YY HH:MM" or without time (e.g. "17-May-26 4:00" or "02-Jun-26")
  const customMatch = cleanStr.match(
    /^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (customMatch) {
    const day = parseInt(customMatch[1], 10);
    const mStr = customMatch[2].toLowerCase();
    let year = parseInt(customMatch[3], 10);
    if (year < 100) year += 2000;

    const monthNames = [
      "jan",
      "feb",
      "mar",
      "apr",
      "may",
      "jun",
      "jul",
      "aug",
      "sep",
      "oct",
      "nov",
      "dec",
    ];
    const monthIdx = monthNames.findIndex((m) => mStr.startsWith(m));

    const hour = customMatch[4] ? parseInt(customMatch[4], 10) : 0;
    const min = customMatch[5] ? parseInt(customMatch[5], 10) : 0;
    const sec = customMatch[6] ? parseInt(customMatch[6], 10) : 0;

    if (monthIdx !== -1 && !isNaN(day) && !isNaN(year)) {
      const parsed = new Date(year, monthIdx, day, hour, min, sec);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }

  return null;
};

const formatForDateTimeLocal = (dateString?: string): string => {
  const d = parseDateString(dateString);
  if (d) {
    const pad = (num: number) => String(num).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const min = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }
  return "";
};

const formatDateTimeString = (
  dateVal?: string | Date | number | null,
): string => {
  if (!dateVal) return "";
  return formatSystemDate(dateVal);
};

export const VesselEntryForm: React.FC<VesselEntryFormProps> = ({
  onBack,
  onSubmitApp,
  options,
  initialData,
  isEditMode,
  isAdmin,
  authRole = 'user',
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSavingControlNo, setIsSavingControlNo] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);

  const [controlNumber, setControlNumber] = useState<string>(
    initialData?.id || "",
  );
  const [isLoadingControlNum, setIsLoadingControlNum] = useState(false);

  const [formData, setFormData] = useState<Partial<VesselApplication>>({
    applicationType: "VEP",
    vesselName: initialData?.vesselName || "",
    agent: initialData?.agent || "",
    voyageType: initialData?.voyageType || "",
    vesselType: initialData?.vesselType || "",
    voyageNo: initialData?.voyageNo || "",
    shippingLine: initialData?.shippingLine || "",
    masterName: initialData?.masterName || "",
    registry: initialData?.registry || "",
    grossTonnage: initialData?.grossTonnage || "",
    loa: initialData?.loa || "",
    terminal: initialData?.terminal || "",
    cargoDescription: initialData?.cargoDescription || "",
    arrivalDate: initialData?.arrivalDate || "",
    departureDate: initialData?.departureDate || "",
    purpose: initialData?.purpose || "",
    origin: initialData?.origin || "",
    nextPort: initialData?.nextPort || "",
    vesselOperations: initialData?.vesselOperations || "",
    submitterName: initialData?.submitterName || "",
    signatureType: initialData?.signatureType || "draw",
    signatureData: initialData?.signatureData || "",
  });

  const isDateChronologyInvalid = React.useMemo(() => {
    if (formData.arrivalDate && formData.departureDate) {
      const arr = parseDateString(formData.arrivalDate);
      const dep = parseDateString(formData.departureDate);
      return !!(arr && dep && dep.getTime() < arr.getTime());
    }
    return false;
  }, [formData.arrivalDate, formData.departureDate]);

  const terminalOptions = React.useMemo(() => {
    const list = (options?.terminals || []).map(normalizeTerminal).filter(Boolean);
    if (list.length > 0) {
      return Array.from(new Set(list)).sort();
    }
    return [...FAB_PORT_TERMINALS];
  }, [options?.terminals]);

  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const getMousePos = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;
    if ("touches" in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDrawing = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.strokeStyle = "#020617"; // slate-950
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const pos = getMousePos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pos = getMousePos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveSignature();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setFormData((prev) => ({ ...prev, signatureData: "" }));
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    setFormData((prev) => ({ ...prev, signatureData: dataUrl }));
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setFormData((prev) => ({
          ...prev,
          signatureType: "upload",
          signatureData: reader.result as string,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const fullControlNumber = React.useMemo(() => {
    if (
      !controlNumber ||
      controlNumber.startsWith("N/A") ||
      controlNumber === "ERROR"
    )
      return controlNumber;

    const baseMatch = controlNumber.match(/^(PSD-\d+-\d+)/i);
    const base = baseMatch ? baseMatch[1] : controlNumber;

    const voyageType = (formData.voyageType || "").toUpperCase();
    const vType = (formData.vesselType || "").toUpperCase();
    const purpose = (formData.purpose || "").toUpperCase();
    const isPassenger =
      vType === "PASSENGER" ||
      vType.includes("PASSENGER") ||
      purpose === "PASSENGER" ||
      purpose.includes("PASSENGER");

    if (isPassenger) return `${base}-P`;
    if (voyageType === "FOREIGN") return `${base}-F`;
    if (voyageType === "DOMESTIC") return `${base}-D`;
    return base;
  }, [controlNumber, formData.voyageType, formData.vesselType, formData.purpose]);

  const usedControlNumbersStr = options?.usedControlNumbers?.join(",") || "";

  useEffect(() => {
    if (initialData?.id) {
      setControlNumber(initialData.id);
      setIsLoadingControlNum(false);
      return;
    }

    setIsLoadingControlNum(true);
    let isMounted = true;

    const fetchAndSetControlNumber = async () => {
      try {
        let csvText = "";
        let isMock = false;
        let rows: string[][] = [];
        let fetchedSuccessfully = false;

        try {
          const { getAccessToken, getVesselMasterSpreadsheetId } = await import('../services/googleSheetsService');
          const token = await getAccessToken();
          const spreadId = getVesselMasterSpreadsheetId();

          if (token) {
            try {
              const metaResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadId}?fields=sheets.properties(title,sheetId)`, {
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (metaResponse.ok) {
                const metaData = await metaResponse.json();
                const sheetsList = metaData.sheets || [];
                const foundSheet = sheetsList.find((s: any) => Number(s.properties?.sheetId) === 960645385);
                const targetSheetName = foundSheet?.properties?.title || sheetsList[0]?.properties?.title || 'Sheet1';

                const res = await fetch(
                  `https://sheets.googleapis.com/v4/spreadsheets/${spreadId}/values/'${encodeURIComponent(targetSheetName)}'!A:F`,
                  { headers: { 'Authorization': `Bearer ${token}` } }
                );
                if (res.ok) {
                  const data = await res.json();
                  if (data.values) {
                    rows = data.values;
                    fetchedSuccessfully = true;
                    isMock = false;
                  }
                }
              }
            } catch (apiErr) {
              console.warn("[VesselEntryForm] Google Sheets API fetch failed, trying CSV export:", apiErr);
            }
          }

          if (!fetchedSuccessfully) {
            try {
              const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadId}/export?format=csv&gid=960645385&t=${Date.now()}`;
              const headers: HeadersInit = {};
              if (token) headers['Authorization'] = `Bearer ${token}`;
              const res = await fetch(sheetUrl, { headers, cache: "no-store" });
              if (res.ok && !res.redirected) {
                csvText = await res.text();
                isMock = false;
              }
            } catch {
              // Network/CORS export fallback
            }
          }
        } catch (err) {
          console.warn("[VesselEntryForm] Sheets fetch error, using local fallback:", err);
        }

        // Fast fallback to bundled static CSV if sheet not fetched
        if (!fetchedSuccessfully && (!csvText || csvText.length === 0)) {
          csvText = vesselsCsvFallback || '';
          isMock = true;
        }

        if (!fetchedSuccessfully && csvText) {
          await new Promise<void>((resolve) => {
            Papa.parse(csvText, {
              header: false,
              complete: (result) => {
                rows = (result.data || []) as string[][];
                fetchedSuccessfully = true;
                resolve();
              },
              error: () => resolve()
            });
          });
        }

        if (!isMounted) return;

        let maxSeqNum = 0;
        let yearPrefix = new Date().getFullYear().toString().slice(-2) || "26";
        let hasAnyPsd = false;
        const usedBasesSet = new Set<string>();

        // 1. Scan rows
        (rows || []).forEach((row) => {
          if (row && row[0]) {
            const ctrl = row[0].trim().toUpperCase();
            if (ctrl.startsWith("PSD-")) {
              if (isMock && (!row[5] || row[5].trim() === "")) return;
              hasAnyPsd = true;
              const match = ctrl.match(/^PSD-(\d{2})-(\d+)/i);
              if (match) {
                const yr = match[1];
                const seq = parseInt(match[2], 10);
                if (!isNaN(seq)) {
                  usedBasesSet.add(`PSD-${yr}-${String(seq).padStart(3, '0')}`);
                  if (seq > maxSeqNum) {
                    maxSeqNum = seq;
                    yearPrefix = yr;
                  }
                }
              }
            }
          }
        });

        // 2. Scan options?.usedControlNumbers safely
        if (options?.usedControlNumbers) {
          options.usedControlNumbers.forEach((ctrlNum) => {
            if (!ctrlNum || typeof ctrlNum !== 'string') return;
            const ctrl = ctrlNum.trim().toUpperCase();
            if (ctrl.startsWith("PSD-")) {
              hasAnyPsd = true;
              const match = ctrl.match(/^PSD-(\d{2})-(\d+)/i);
              if (match) {
                const yr = match[1];
                const seq = parseInt(match[2], 10);
                if (!isNaN(seq)) {
                  usedBasesSet.add(`PSD-${yr}-${String(seq).padStart(3, '0')}`);
                  if (seq > maxSeqNum) {
                    maxSeqNum = seq;
                    yearPrefix = yr;
                  }
                }
              }
            }
          });
        }

        // 3. Find next available sequence number safely (strictly bounded)
        let nextSeqNum = hasAnyPsd ? maxSeqNum + 1 : 1;
        for (let step = 0; step < 500; step++) {
          const candidateBase = `PSD-${yearPrefix}-${String(nextSeqNum).padStart(3, '0')}`;
          if (!usedBasesSet.has(candidateBase)) {
            break;
          }
          nextSeqNum++;
        }

        const finalControlNo = `PSD-${yearPrefix}-${String(nextSeqNum).padStart(3, '0')}`;
        if (isMounted) {
          setControlNumber(finalControlNo);
        }
      } catch (e) {
        console.error("[VesselEntryForm] Error generating control number:", e);
        if (isMounted) {
          setControlNumber("PSD-26-001");
        }
      } finally {
        if (isMounted) {
          setIsLoadingControlNum(false);
        }
      }
    };

    fetchAndSetControlNumber();

    return () => {
      isMounted = false;
    };
  }, [initialData?.id, usedControlNumbersStr]);

  // Synchronize suffix when Voyage Type, Vessel Type, or Purpose of Call changes
  useEffect(() => {
    if (!controlNumber) return;
    if (controlNumber.startsWith("N/A") || controlNumber === "ERROR") return;

    const baseMatch = controlNumber.match(/^(PSD-\d+-\d+)/i);
    const base = baseMatch ? baseMatch[1] : controlNumber;

    const voyageType = (formData.voyageType || "").toUpperCase();
    const vType = (formData.vesselType || "").toUpperCase();
    const purpose = (formData.purpose || "").toUpperCase();
    const isPassenger =
      vType === "PASSENGER" ||
      vType.includes("PASSENGER") ||
      purpose === "PASSENGER" ||
      purpose.includes("PASSENGER");

    let suffix = "";
    if (isPassenger) suffix = "-P";
    else if (voyageType === "FOREIGN") suffix = "-F";
    else if (voyageType === "DOMESTIC") suffix = "-D";

    const expectedFull = suffix ? `${base}${suffix}` : base;
    if (controlNumber !== expectedFull) {
      setControlNumber(expectedFull);
    }
  }, [formData.voyageType, formData.vesselType, formData.purpose, controlNumber]);

  const handleGeneratePDF = async () => {
    const element = document.getElementById("printable-permit");
    if (!element) return;

    setIsGeneratingPDF(true);
    try {
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        alert("Please allow popups to print this permit.");
        setIsGeneratingPDF(false);
        return;
      }

      // Clone the element so we can modify its HTML attributes in isolation
      const clonedElement = element.cloneNode(true) as HTMLElement;

      // Make it wider and tighter for high-quality printing
      clonedElement.classList.remove("max-w-4xl", "mx-auto", "pb-12");
      clonedElement.style.width = "1200px";
      clonedElement.style.maxWidth = "1200px";

      const clonedForm = clonedElement.querySelector("form");
      if (clonedForm) {
        clonedForm.classList.remove("p-4", "sm:p-8", "shadow-sm");
        clonedForm.classList.add("p-3", "sm:p-4");
      }

      // Absolute-ize absolute assets like logos so they render in about:blank
      clonedElement.querySelectorAll("img").forEach((img) => {
        const src = img.getAttribute("src");
        if (src && src.startsWith("/")) {
          img.setAttribute("src", window.location.origin + src);
        }
      });

      // Select interactive elements in both original and cloned DOM
      const originalInputs = Array.from(
        element.querySelectorAll("input, select, textarea"),
      );
      const clonedInputs = Array.from(
        clonedElement.querySelectorAll("input, select, textarea"),
      );

      clonedInputs.forEach((clonedInput, index) => {
        let originalInput = originalInputs[index];
        const nameAttr = clonedInput.getAttribute("name");

        // Safely align by name attribute if available to handle any potential array index shift
        if (nameAttr) {
          const matchedByName = originalInputs.find(
            (item) => item.getAttribute("name") === nameAttr,
          );
          if (matchedByName) {
            originalInput = matchedByName;
          }
        }

        if (!originalInput) return;

        const tagName = clonedInput.tagName.toLowerCase();

        if (tagName === "input") {
          const originalInputEl = originalInput as HTMLInputElement;
          const clonedInputEl = clonedInput as HTMLInputElement;

          if (
            originalInputEl.type === "checkbox" ||
            originalInputEl.type === "radio"
          ) {
            if (originalInputEl.checked) {
              clonedInputEl.setAttribute("checked", "checked");
            } else {
              clonedInputEl.removeAttribute("checked");
            }
          } else {
            // Text inputs, date inputs: Create a styled div instead to display value elegantly
            let textVal = originalInputEl.value || "";

            const isDateField =
              nameAttr === "arrivalDate" ||
              nameAttr === "departureDate" ||
              originalInputEl.type === "datetime-local";

            if (isDateField) {
              const stateDate =
                nameAttr === "arrivalDate"
                  ? formData.arrivalDate
                  : nameAttr === "departureDate"
                    ? formData.departureDate
                    : "";
              textVal = originalInputEl.value || stateDate || "";

              if (textVal) {
                // Use robust custom date parser matching consistent format
                textVal = formatDateTimeString(textVal);
              }
            }

            const replacementDiv = document.createElement("div");
            // Copy class names and inline styles exactly to retain identity, spacing, and borders, but strip background classes
            replacementDiv.className = clonedInputEl.className.replace(
              /\bbg-\S+/g,
              "bg-transparent",
            );
            replacementDiv.setAttribute(
              "style",
              clonedInputEl.getAttribute("style") || "",
            );

            // Avoid collapsing the height of the element if value is empty (\u00a0 is non-breaking space)
            replacementDiv.textContent = textVal || "\u00a0";

            // Ensure any flex items center and block layout properties map nicely
            if (
              !replacementDiv.className.includes("flex") &&
              !replacementDiv.className.includes("block")
            ) {
              replacementDiv.className += " block";
            }

            clonedInputEl.parentNode?.replaceChild(
              replacementDiv,
              clonedInputEl,
            );
          }
        } else if (tagName === "textarea") {
          const originalTextarea = originalInput as HTMLTextAreaElement;
          const clonedTextarea = clonedInput as HTMLTextAreaElement;

          const textVal = originalTextarea.value || "";
          const replacementDiv = document.createElement("div");

          // Copy class names and inline styles exactly to retain heights, scroll, sizing, but strip backgrounds
          replacementDiv.className = clonedTextarea.className.replace(
            /\bbg-\S+/g,
            "bg-transparent",
          );
          if (!replacementDiv.className.includes("whitespace-pre-wrap")) {
            replacementDiv.className += " whitespace-pre-wrap";
          }
          if (!replacementDiv.className.includes("block")) {
            replacementDiv.className += " block";
          }
          replacementDiv.setAttribute(
            "style",
            clonedTextarea.getAttribute("style") || "",
          );
          replacementDiv.textContent = textVal || "\u00a0";

          clonedTextarea.parentNode?.replaceChild(
            replacementDiv,
            clonedTextarea,
          );
        } else if (tagName === "select") {
          const originalSelect = originalInput as HTMLSelectElement;
          const clonedSelect = clonedInput as HTMLSelectElement;

          // Get the selected option's text
          const selectedText =
            originalSelect.options[originalSelect.selectedIndex]?.text || "";
          const replacementDiv = document.createElement("div");

          // Copy class names and inline styles exactly to retain matching size/borders, but strip backgrounds
          replacementDiv.className = clonedSelect.className.replace(
            /\bbg-\S+/g,
            "bg-transparent",
          );
          if (
            !replacementDiv.className.includes("block") &&
            !replacementDiv.className.includes("flex")
          ) {
            replacementDiv.className += " block";
          }
          replacementDiv.setAttribute(
            "style",
            clonedSelect.getAttribute("style") || "",
          );

          // If empty or placeholder is selected, display empty space
          replacementDiv.textContent =
            selectedText === "-Select-" || !selectedText
              ? "\u00a0"
              : selectedText;
          clonedSelect.parentNode?.replaceChild(replacementDiv, clonedSelect);
        }
      });

      // Retain structure & format: ensure md: responsive classes are translated to normal and print classes
      // so the A4/Print layout retains the desktop 12-column grid layout structures and borders.
      clonedElement.querySelectorAll("*").forEach((el) => {
        const classAttr = el.getAttribute("class");
        if (classAttr) {
          let classes = classAttr.split(/\s+/);
          let newClasses: string[] = [];
          classes.forEach((cls) => {
            if (!cls) return;
            newClasses.push(cls);
            if (cls.startsWith("md:")) {
              const baseClass = cls.substring(3);
              if (!classes.includes(baseClass)) {
                newClasses.push(baseClass);
              }
              newClasses.push(`print:${baseClass}`);
            }
          });
          el.setAttribute("class", newClasses.join(" "));
        }
      });

      // Purge print-hidden and screen-only elements from the captured HTML
      clonedElement
        .querySelectorAll(".print\\:hidden, .hidden")
        .forEach((el) => {
          el.parentNode?.removeChild(el);
        });

      // Prepare styles for preprocessing to bypass html2canvas oklch/oklab parsing crashes.
      // We temporarily replace all oklch/oklab attributes with standard fallback RGB colors.
      const styleRollback: {
        element: HTMLElement;
        text?: string;
        disabled?: boolean;
      }[] = [];
      const linkRollback: { element: HTMLLinkElement; disabled: boolean }[] =
        [];
      const originalGetComputedStyle = window.getComputedStyle;

      const sanitizeColorString = (val: string): string => {
        if (!val || typeof val !== "string") return val;
        let result = val;
        const colorFuncs = ["oklch", "oklab"];

        for (const func of colorFuncs) {
          let index = result.indexOf(func + "(");
          while (index !== -1) {
            let depth = 1;
            let end = -1;
            const start = index + func.length + 1;
            for (let i = start; i < result.length; i++) {
              if (result[i] === "(") depth++;
              else if (result[i] === ")") {
                depth--;
                if (depth === 0) {
                  end = i;
                  break;
                }
              }
            }

            if (end !== -1) {
              const fullColorSpec = result.substring(index, end + 1);
              let replacement = "rgb(148, 163, 184)"; // Fallback slate-400 color
              if (
                fullColorSpec.includes(" / 0") ||
                fullColorSpec.includes("/0")
              ) {
                replacement = "rgba(0,0,0,0)";
              } else if (
                fullColorSpec.toLowerCase().includes("white") ||
                fullColorSpec.includes("0.9") ||
                fullColorSpec.includes(" 1 ") ||
                fullColorSpec.includes(" 1)")
              ) {
                replacement = "rgb(255,255,255)";
              } else if (
                fullColorSpec.includes("0.2") ||
                fullColorSpec.includes("0.1") ||
                fullColorSpec.includes("0.0")
              ) {
                replacement = "rgba(148, 163, 184, 0.2)";
              } else if (
                fullColorSpec.includes(" 0 ") ||
                fullColorSpec.includes(" 0)")
              ) {
                replacement = "rgb(0,0,0)";
              }
              result =
                result.substring(0, index) +
                replacement +
                result.substring(end + 1);
              index = result.indexOf(func + "(");
            } else {
              break;
            }
          }
        }
        return result;
      };

      try {
        // Intercept window.getComputedStyle to rewrite modern CSS-color-4 output format to rgb/rgba
        window.getComputedStyle = function (el, pseudoElt) {
          const style = originalGetComputedStyle(el, pseudoElt);
          return new Proxy(style, {
            get(target, prop) {
              if (typeof prop === "string") {
                if (prop === "getPropertyValue") {
                  return function (propertyName: string) {
                    const val = target.getPropertyValue(propertyName);
                    return sanitizeColorString(val);
                  };
                }
                const val = target[prop as any];
                if (typeof val === "string") {
                  return sanitizeColorString(val);
                }
              }
              const val = Reflect.get(target, prop);
              if (typeof val === "function") {
                return val.bind(target);
              }
              return val;
            },
          });
        };

        // Process internal style blocks using our oklch-to-rgb converter
        document.querySelectorAll("style").forEach((styleEl) => {
          if (
            styleEl.textContent &&
            (styleEl.textContent.includes("oklch") ||
              styleEl.textContent.includes("oklab"))
          ) {
            styleRollback.push({ element: styleEl, text: styleEl.textContent });
            styleEl.textContent = oklchToRgb(styleEl.textContent);
          }
        });

        // Fetch and process same-origin stylesheet links
        const linkPromises: Promise<void>[] = [];
        document
          .querySelectorAll('link[rel="stylesheet"]')
          .forEach((linkEl) => {
            const href = linkEl.getAttribute("href");
            if (href) {
              if (
                href.startsWith("/") ||
                href.startsWith(window.location.origin)
              ) {
                const promise = fetch(href)
                  .then((res) => res.text())
                  .then((cssText) => {
                    if (
                      cssText.includes("oklch") ||
                      cssText.includes("oklab")
                    ) {
                      const el = linkEl as HTMLLinkElement;
                      linkRollback.push({ element: el, disabled: el.disabled });
                      el.disabled = true;

                      const tempStyle = document.createElement("style");
                      tempStyle.textContent = oklchToRgb(cssText);
                      document.head.appendChild(tempStyle);
                      styleRollback.push({ element: tempStyle });
                    }
                  })
                  .catch((err) => {
                    console.warn(
                      "Could not preprocess link stylesheet:",
                      href,
                      err,
                    );
                  });
                linkPromises.push(promise);
              }
            }
          });

        if (linkPromises.length > 0) {
          await Promise.all(linkPromises);
        }
      } catch (err) {
        console.warn("Error during stylesheet oklch/oklab sanitization:", err);
      }

      let imgData = "";
      const tempContainer = document.createElement("div");

      try {
        // Append temporarily offscreen to the DOM so html2canvas renders the visual layers correctly
        tempContainer.style.position = "fixed";
        tempContainer.style.left = "-9999px";
        tempContainer.style.top = "0";
        tempContainer.style.width = "1200px"; // Fixed high resolution desktop reference layout matching cloned element
        tempContainer.style.backgroundColor = "#ffffff";
        tempContainer.style.zIndex = "-9999";
        tempContainer.style.padding = "0";
        tempContainer.appendChild(clonedElement);
        document.body.appendChild(tempContainer);

        // Brief pause to allow the styles and assets to mount fully in the window's layout pipeline
        await new Promise((resolve) => setTimeout(resolve, 350));

        const canvas = await html2canvas(clonedElement, {
          useCORS: true,
          allowTaint: true,
          scale: 2.5, // Ultra crisp retinal output
          backgroundColor: "#ffffff",
          logging: false,
        });

        imgData = canvas.toDataURL("image/png");
      } finally {
        // Restore window.getComputedStyle immediately to prevent affecting original app behaviors
        window.getComputedStyle = originalGetComputedStyle;

        // Post-capture cleanup of DOM
        if (tempContainer.parentNode) {
          document.body.removeChild(tempContainer);
        }

        // Restore original styles immediately after capture so layout style is unbroken on-screen
        styleRollback.forEach((item) => {
          if (item.text !== undefined) {
            item.element.textContent = item.text;
          } else {
            item.element.parentNode?.removeChild(item.element);
          }
        });

        linkRollback.forEach((item) => {
          item.element.disabled = item.disabled;
        });
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Vessel Entry Permit</title>
            <style>
              @page {
                size: A4 portrait;
                margin: 0 !important;
              }
              body {
                margin: 0 !important;
                padding: 0 !important;
                background-color: white !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: flex-start !important;
                height: 297mm !important;
                width: 210mm !important;
                box-sizing: border-box !important;
                position: relative !important;
              }
              .half-page-container {
                width: 210mm !important;
                height: 148.5mm !important; /* Exactly 50% of 297mm */
                padding: 1.5mm 1.5mm !important; /* Minimized padding to make the permit stretch edge-to-edge vertically & horizontally */
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                box-sizing: border-box !important;
                border-bottom: 2px dashed #cbd5e1 !important; /* Elegant cutting guide line */
              }
              .half-page-container img {
                width: 100% !important;
                height: 100% !important;
                max-width: 100% !important;
                max-height: 100% !important;
                object-fit: contain !important;
                display: block !important;
              }
              .cut-guide-text {
                font-family: system-ui, -apple-system, sans-serif !important;
                font-size: 8px !important;
                font-weight: bold !important;
                color: #94a3b8 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.15em !important;
                position: absolute !important;
                top: 145.5mm !important;
                left: 50% !important;
                transform: translateX(-50%) !important;
                background: white !important;
                padding: 0 8px !important;
                user-select: none !important;
              }
            </style>
          </head>
          <body>
            <div class="half-page-container">
              <img src="${imgData}" />
            </div>
            <div class="cut-guide-text">CUT HERE FOR HALF-PAGE PERMIT</div>
            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (error) {
      console.error("Error opening print window", error);
      alert("Failed to open print window.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    // Keep datetime strings intact, and capitalize everything else (vessel names, agents, descriptions, etc.)
    const isDateTime =
      name === "arrivalDate" ||
      name === "departureDate" ||
      e.target.getAttribute("type") === "datetime-local";
    const processedValue = isDateTime ? value : value.toUpperCase();
    setFormData((prev) => ({ ...prev, [name]: processedValue }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let numericValue = value.replace(/[^\d.]/g, "");
    const parts = numericValue.split(".");
    if (parts.length > 2)
      numericValue = parts[0] + "." + parts.slice(1).join("");
    const finalParts = numericValue.split(".");
    if (finalParts[0]) {
      finalParts[0] = finalParts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    const formattedValue = finalParts.join(".");
    setFormData((prev) => ({ ...prev, [name]: formattedValue }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDateError(null);

    if (isDateChronologyInvalid) {
      setDateError(
        "Chronology error: Expected Time of Departure (ETD) must not come before Estimated Time of Arrival (ETA).",
      );
      const element = document.getElementById("printable-permit");
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }

    if (!isEditMode) {
      if (!formData.submitterName || !formData.submitterName.trim()) {
        setDateError(
          "Printed Name Required: Please enter your full authorized representative name at the bottom before submitting.",
        );
        return;
      }
      if (!formData.signatureData) {
        setDateError(
          "Signature Authorization Required: Please draw your signature on the pad or upload a signature image below before submitting.",
        );
        return;
      }
    }

    setIsSubmitting(true);

    // Simulate API request/Spreadsheet update
    setTimeout(() => {
      setIsSubmitting(false);
      setShowSuccess(true);
      if (onSubmitApp) {
        onSubmitApp({ ...formData, id: fullControlNumber } as any);
      }

      setTimeout(() => {
        setShowSuccess(false);
        if (!isEditMode) {
          setFormData({
            applicationType: "VEP",
            vesselName: "",
            agent: "",
            voyageType: "",
            vesselType: "",
            voyageNo: "",
            shippingLine: "",
            masterName: "",
            registry: "",
            grossTonnage: "",
            loa: "",
            terminal: "",
            cargoDescription: "",
            arrivalDate: "",
            departureDate: "",
            purpose: "",
            origin: "",
            nextPort: "",
            vesselOperations: "",
            submitterName: "",
            signatureType: "draw",
            signatureData: "",
          });
        }
        onBack();
      }, 3000);
    }, 1000);
  };

  return (
    <div
      id="printable-permit"
      className="max-w-4xl mx-auto font-sans text-sm pb-12 print:pb-0 print:m-0 print:w-full print:max-w-none print:absolute print:top-0 print:left-0 bg-white"
    >
      <div className="mb-6 print:hidden">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-600 hover:text-fab-blue transition-colors font-bold uppercase text-xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          {isEditMode ? "Cancel Edit & Return" : "Back to Dashboard"}
        </button>
      </div>

      {isEditMode && (authRole === 'admin' || authRole === 'checker' || authRole === 'approver') && (
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3 print:hidden">
          <h3 className="font-extrabold text-xs text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-100">
            Stage Control & Actions (VEP)
          </h3>
          <p className="text-slate-600 text-xs leading-relaxed font-semibold">
            This vessel entry permit is in review mode. You can edit the VEP Control Number below and update the Firestore records instantly.
          </p>
          <div className="bg-amber-50/70 p-4 rounded-lg border border-amber-200/50 space-y-2 max-w-md">
            <label className="block text-[10px] font-black uppercase tracking-wider text-amber-800">
              Edit VEP Control Number
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={controlNumber}
                onChange={(e) => setControlNumber(e.target.value.toUpperCase())}
                placeholder="PSD-26-XXX"
                className="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1.5 text-xs font-mono font-bold uppercase text-slate-900 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="button"
                disabled={isSavingControlNo || controlNumber.trim() === (initialData?.id || '') || !controlNumber.trim()}
                onClick={async () => {
                  if (!controlNumber.trim()) return;
                  try {
                    setIsSavingControlNo(true);
                    await onSubmitApp?.({
                      ...formData,
                      id: controlNumber.trim(),
                    } as any);
                    alert("VEP Control Number successfully updated!");
                  } catch (err: any) {
                    console.error("Failed to update VEP Control Number:", err);
                    alert(`Failed to update: ${err.message}`);
                  } finally {
                    setIsSavingControlNo(false);
                  }
                }}
                className="bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-[10px] uppercase tracking-wider px-3.5 py-1.5 rounded transition-colors cursor-pointer shrink-0"
              >
                {isSavingControlNo ? "Saving..." : "Update"}
              </button>
            </div>
            <p className="text-[9px] text-amber-700 font-medium leading-relaxed">
              Notice: Changing this will rename the document key in Firestore and automatically update linked records.
            </p>
          </div>
        </div>
      )}

      {showSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-lg mb-6 flex items-center gap-3"
        >
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-bold">Form successfully submitted!</span>
        </motion.div>
      )}

      {dateError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border-2 border-red-500 text-red-700 p-4 rounded-lg mb-6 flex items-center gap-3"
        >
          <span className="font-bold uppercase tracking-wide text-xs">
            {dateError}
          </span>
        </motion.div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white border-2 border-slate-800 p-4 sm:p-8 shadow-sm"
      >
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start mb-6 border-b-2 border-slate-800 pb-4 gap-4">
          <div className="flex gap-4 items-center">
            <img
              src={fabLogo}
              alt="FAB Logo"
              className="w-24 h-24 sm:w-32 sm:h-32 object-contain"
            />
            <div>
              <h1 className="font-bold whitespace-nowrap text-xs sm:text-base">
                REPUBLIC OF THE PHILIPPINES
              </h1>
              <h2 className="font-bold whitespace-nowrap text-[10px] sm:text-[13px]">
                AUTHORITY OF THE FREEPORT AREA OF BATAAN
              </h2>
              <p className="text-[9px] sm:text-[11px]">
                Freeport Area of Bataan, Mariveles Bataan
              </p>
              <h3 className="font-black text-sm sm:text-lg mt-2 tracking-wide uppercase">
                PORT SERVICES DIVISION
              </h3>
              <h4 className="font-bold text-base sm:text-xl mt-1 border-b-[3px] inline-block border-slate-800 pb-0.5">
                Vessel Entry Permit (VEP)
              </h4>
            </div>
          </div>

          <div className="w-full sm:w-64 sm:-mt-2 flex flex-col justify-between">
            <p className="text-[9px] italic leading-tight text-gray-700">
              Privacy Notice:
              <br />
              "The Authority of the Freeport Area of Bataan (AFAB) ensures that
              the data gathered in this form are held under strict
              confidentiality in accordance with the R.A.10173 otherwise known
              as the Data Privacy Act of 2012."
            </p>
            <div className="mt-8 sm:mt-auto space-y-2 pt-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold whitespace-nowrap text-black uppercase tracking-wider">
                  Control No:
                </span>
                {isLoadingControlNum ? (
                  <span className="animate-pulse font-mono font-bold text-sm text-black">
                    LOADING...
                  </span>
                ) : isEditMode ? (
                  (isAdmin || authRole === 'admin' || authRole === 'checker' || authRole === 'approver') ? (
                    <input
                      type="text"
                      className="font-mono font-bold text-sm text-black bg-transparent border-b border-dashed border-black outline-none px-1 uppercase w-full"
                      value={controlNumber}
                      onChange={(e) =>
                        setControlNumber(e.target.value.toUpperCase())
                      }
                    />
                  ) : (
                    <span
                      className="font-mono font-bold text-sm text-slate-755 bg-slate-100 border border-slate-250 px-2.5 py-0.5 rounded select-all cursor-default"
                      title="Control Number is not editable on the user side."
                    >
                      {fullControlNumber}
                    </span>
                  )
                ) : (fullControlNumber || controlNumber) ? (
                  <span
                    className="font-mono font-bold text-sm text-slate-800 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded select-all cursor-default"
                    title="Control Number is automatically generated."
                  >
                    {fullControlNumber || controlNumber}
                  </span>
                ) : (
                  <span className="font-mono font-bold text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    PSD-26-PENDING
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold whitespace-nowrap">
                  Berthing Meeting Schedule:
                </span>
                <input
                  type="text"
                  className="border-b border-black w-full outline-none px-1 text-xs bg-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SHIP PARTICULARS */}
        <div className="bg-slate-100 print:bg-slate-50 border-2 border-slate-800 text-center font-bold uppercase tracking-widest py-1 mb-0 border-b-0">
          SHIP PARTICULARS
        </div>

        <div className="border-2 border-slate-800 grid grid-cols-12 gap-0 text-[11px]">
          {/* Row 1 */}
          <div className="col-span-12 md:col-span-4 border-b border-slate-800 p-2 flex flex-col md:border-r border-r-0">
            <label className="font-bold mb-1">1. Vessel Name:</label>
            <input
              type="text"
              name="vesselName"
              value={formData.vesselName}
              onChange={handleChange}
              className="w-full bg-transparent outline-none uppercase font-bold text-black mt-1"
              required
            />
          </div>
          <div className="col-span-12 md:col-span-3 border-b border-slate-800 p-2 flex flex-col md:border-r border-r-0">
            <label className="font-bold mb-1">2. Shipping Agency:</label>
            <input
              type="text"
              name="agent"
              value={formData.agent || ""}
              onChange={handleChange}
              className="w-full bg-transparent outline-none uppercase font-bold text-black mt-1"
              required
            />
          </div>
          <div className="col-span-6 md:col-span-2 border-b border-slate-800 p-2 flex flex-col border-r">
            <label className="font-bold mb-1">3. Class/Type:</label>
            <select
              name="vesselType"
              value={formData.vesselType}
              onChange={handleChange}
              className="w-full bg-transparent outline-none uppercase font-bold text-black cursor-pointer mt-1"
              required
            >
              <option value="">-Select-</option>
              {options?.types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-3 md:col-span-2 border-b border-slate-800 p-2 flex flex-col border-r">
            <label className="font-bold mb-1">3b. Voy Type:</label>
            <select
              name="voyageType"
              value={formData.voyageType}
              onChange={handleChange}
              className="w-full bg-transparent outline-none uppercase font-bold text-black cursor-pointer mt-1"
              required
            >
              <option value="">-Select-</option>
              {options?.voyages.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-3 md:col-span-1 border-b border-slate-800 p-2 flex flex-col">
            <label className="font-bold mb-1">4. Voy No.</label>
            <input
              type="text"
              name="voyageNo"
              value={formData.voyageNo}
              onChange={handleChange}
              className="w-full bg-transparent outline-none uppercase font-bold text-black mt-1"
              required
            />
          </div>

          {/* Row 2 */}
          <div className="col-span-12 md:col-span-5 border-b border-slate-800 p-2 flex flex-col md:border-r border-r-0">
            <label className="font-bold mb-1 col-span-12">
              5. Shipping Line Company / Owner:
            </label>
            <input
              type="text"
              name="shippingLine"
              value={formData.shippingLine || ""}
              onChange={handleChange}
              className="w-full bg-transparent outline-none uppercase font-bold text-black mt-1"
              required
            />
          </div>
          <div className="col-span-12 md:col-span-4 border-b border-slate-800 p-2 flex flex-col md:border-r border-r-0">
            <label className="font-bold mb-1">6. Vessel Master's Name:</label>
            <input
              type="text"
              name="masterName"
              value={formData.masterName || ""}
              onChange={handleChange}
              className="w-full bg-transparent outline-none uppercase font-bold text-black mt-1"
              required
            />
          </div>
          <div className="col-span-12 md:col-span-3 border-b border-slate-800 p-2 flex flex-col">
            <label className="font-bold mb-1">7. Vessel Flag:</label>
            <input
              type="text"
              name="registry"
              value={formData.registry || ""}
              onChange={handleChange}
              className="w-full bg-transparent outline-none uppercase font-bold text-black mt-1"
              required
            />
          </div>

          {/* Row 3 */}
          <div className="col-span-6 md:col-span-3 border-b border-slate-800 p-2 flex flex-col border-r">
            <label className="font-bold mb-1">8. Gross Tonnage:</label>
            <input
              type="text"
              name="grossTonnage"
              value={formData.grossTonnage || ""}
              onChange={handleNumberChange}
              className="w-full bg-transparent outline-none uppercase font-bold text-black mt-1"
              required
            />
          </div>
          <div className="col-span-6 md:col-span-2 border-b border-slate-800 p-2 flex flex-col border-r">
            <label className="font-bold mb-1">9. Length Over-All:</label>
            <input
              type="text"
              name="loa"
              value={formData.loa || ""}
              onChange={handleNumberChange}
              className="w-full bg-transparent outline-none uppercase font-bold text-black mt-1"
              required
            />
          </div>
          <div
            className={`col-span-12 md:col-span-3 border-b border-slate-800 p-2 flex flex-col md:border-r border-r-0 transition-all ${isDateChronologyInvalid ? "bg-red-50/70" : ""}`}
          >
            <label className="font-bold mb-1 flex items-center justify-between">
              <span>10. Estimated Time of Arrival (ETA):</span>
              {isDateChronologyInvalid && (
                <span className="text-[8px] text-red-600 uppercase font-bold tracking-wider">
                  Conflict
                </span>
              )}
            </label>
            <input
              type="datetime-local"
              name="arrivalDate"
              value={formatForDateTimeLocal(formData.arrivalDate)}
              onChange={handleChange}
              onClick={(e) => {
                try {
                  if (typeof e.currentTarget.showPicker === "function") {
                    e.currentTarget.showPicker();
                  }
                } catch (err) {
                  console.warn("showPicker not supported:", err);
                }
              }}
              className={`w-full bg-transparent outline-none uppercase font-bold cursor-pointer transition-all mt-1 ${isDateChronologyInvalid ? "text-red-600 bg-red-50" : "text-black"}`}
              required
            />
          </div>
          <div
            className={`col-span-12 md:col-span-4 border-b border-slate-800 p-2 flex flex-col transition-all ${isDateChronologyInvalid ? "bg-red-50/70 border-red-300" : ""}`}
          >
            <label className="font-bold mb-1 flex items-center justify-between">
              <span>11. Estimated Time of Departure (ETD):</span>
              {isDateChronologyInvalid && (
                <span className="text-[8px] text-red-600 uppercase font-bold tracking-wider animate-pulse">
                  Invalid Timeline
                </span>
              )}
            </label>
            <input
              type="datetime-local"
              name="departureDate"
              value={formatForDateTimeLocal(formData.departureDate)}
              onChange={handleChange}
              onClick={(e) => {
                try {
                  if (typeof e.currentTarget.showPicker === "function") {
                    e.currentTarget.showPicker();
                  }
                } catch (err) {
                  console.warn("showPicker not supported:", err);
                }
              }}
              className={`w-full bg-transparent outline-none uppercase font-bold cursor-pointer transition-all mt-1 ${isDateChronologyInvalid ? "text-red-600 font-bold bg-red-50" : "text-black"}`}
              required
            />
            {isDateChronologyInvalid && (
              <span className="text-[8px] text-red-600 font-bold uppercase mt-1">
                ⚠️ ETD must not come before ETA
              </span>
            )}
          </div>

          {/* Row 4 */}
          <div className="col-span-12 md:col-span-5 border-b border-slate-800 p-2 flex flex-col md:border-r border-r-0">
            <label className="font-bold mb-1">12. Purpose of Call:</label>
            <select
              name="purpose"
              value={formData.purpose || ""}
              onChange={handleChange}
              className="w-full bg-transparent outline-none uppercase font-bold text-black cursor-pointer mt-1"
              required
            >
              <option value="">-Select-</option>
              <option value="DISCHARGING OF CARGO">DISCHARGING OF CARGO</option>
              <option value="LOADING OF CARGO">LOADING OF CARGO</option>
              <option value="PASSENGER">PASSENGER</option>
              <option value="USED FOR TOWING">USED FOR TOWING</option>
              <option value="TRAINING OF CADET">TRAINING OF CADET</option>
              <option value="FOR REPAIR">FOR REPAIR</option>
              <option value="SHELTERING">SHELTERING</option>
              <option value="LOADING AND DISCHARGING OF CARGO">
                LOADING AND DISCHARGING OF CARGO
              </option>
              <option value="OTHERS">OTHERS</option>
            </select>
          </div>
          <div className="col-span-6 md:col-span-3 border-b border-slate-800 p-2 flex flex-col border-r">
            <label className="font-bold mb-1">13. Last Port of Call:</label>
            <input
              type="text"
              name="origin"
              value={formData.origin || ""}
              onChange={handleChange}
              className="w-full bg-transparent outline-none uppercase font-bold text-black mt-1"
              required
            />
          </div>
          <div className="col-span-6 md:col-span-4 border-b border-slate-800 p-2 flex flex-col">
            <label className="font-bold mb-1">14. Next Port of Call:</label>
            <input
              type="text"
              name="nextPort"
              value={formData.nextPort || ""}
              onChange={handleChange}
              className="w-full bg-transparent outline-none uppercase font-bold text-black mt-1"
              required
            />
          </div>

          {/* Row 5 */}
          <div className="col-span-12 md:col-span-5 border-b border-slate-800 p-2 flex flex-col md:border-r border-r-0">
            <label className="font-bold mb-1">15. Vessel Operations:</label>
            <select
              name="vesselOperations"
              value={formData.vesselOperations || ""}
              onChange={handleChange}
              className="w-full bg-transparent outline-none uppercase font-bold text-black cursor-pointer mt-1"
              required
            >
              <option value="">-Select-</option>
              <option value="SHIP-SHORE (DIRECT DOCKING)">
                SHIP-SHORE (DIRECT DOCKING)
              </option>
              <option value="SHIP - SHIP">SHIP - SHIP</option>
              <option value="AT ANCHORAGE (FOR DOCKING)">
                AT ANCHORAGE (FOR DOCKING)
              </option>
              <option value="Others">Others</option>
            </select>
          </div>
          <div className="col-span-12 md:col-span-3 border-b border-slate-800 p-2 flex flex-col border-r">
            <label className="font-bold mb-1">16. Port Terminal:</label>
            <select
              name="terminal"
              value={formData.terminal}
              onChange={handleChange}
              className="w-full bg-transparent outline-none uppercase font-bold text-black cursor-pointer mt-1"
              required
            >
              <option value="">-Select-</option>
              {terminalOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-12 md:col-span-4 border-b border-slate-800 p-2 flex flex-col">
            <label className="font-bold mb-1">17. Cargo Description:</label>
            <textarea
              name="cargoDescription"
              value={formData.cargoDescription}
              onChange={handleChange}
              className="w-full bg-transparent outline-none uppercase font-bold text-black resize-none h-16 text-[10px] sm:text-xs mt-1"
              required
            />
          </div>

          {/* Undertaking & Signatures */}
          <div className="col-span-12 p-3 pb-6 border-b border-slate-800">
            <p className="font-bold text-[11px] mb-1">Undertaking :</p>
            <p className="text-[10px] mb-2 leading-tight">
              The undersigned Ship's Owner Representative / Ship's Agent of the
              Vessel submits this berth application at FAB in accordance to the
              following conditions :
            </p>
            <ol className="list-decimal list-outside text-[10px] space-y-0.5 ml-4 leading-tight text-slate-700">
              <li>
                Complete all Arrival documents as required in the Citizen's
                charter or the AFAB. Failure to submit the same on or before
                application for vessel exit, the said application shall not be
                processed.
              </li>
              <li>
                Any false statement or misrepresentation in this application
                shall be subjected to the penalties imposed under R.A. 9728 or
                other applicable laws.
              </li>
              <li>
                This form should be submitted at least 24 hours (foreign vessel)
                prior to its arrival.
              </li>
              <li>
                Authorized Ship's Agent warrants that the cargoes for
                discharging/loading are properly documented & assumes full
                responsibility.
              </li>
              <li>
                The shipping lines or agent or authorized representative agrees
                the non-settlement of previous dues shall be ground for refusal
                to berth its vessel.
              </li>
            </ol>
          </div>

          {/* Interactive Signature Pad and Name Box (Hidden in Print) */}
          {!isEditMode && (
            <div className="col-span-12 p-5 bg-slate-50 border-b border-slate-800 print:hidden">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-fab-blue text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">
                  18
                </div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                  Applicant Signature & Verification Details
                </h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Name Box */}
                <div className="flex flex-col justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1 flex items-center gap-1">
                      Applicant Full Name{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="submitterName"
                      value={formData.submitterName || ""}
                      onChange={handleChange}
                      placeholder="e.g. JUAN S. DELA CRUZ"
                      className="w-full bg-white border border-slate-300 rounded px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-900 outline-none focus:border-fab-blue transition-colors focus:ring-1 focus:ring-fab-blue"
                      required
                    />
                  </div>
                  <div className="mt-3 md:mt-0 bg-blue-50/50 border border-blue-100 rounded-lg p-3 text-[11px] text-blue-800 leading-normal">
                    <strong>Authority Verification Standard:</strong> Re-verify
                    that the cargo descriptions, tonnage index, and agent
                    profiles filled in the ship particulars section match your
                    verified shipping log credentials before submitting.
                  </div>
                </div>

                {/* Submitter Signature Options */}
                <div className="flex flex-col">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    Select Signature Method{" "}
                    <span className="text-red-500">*</span>
                  </label>

                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          signatureType: "draw",
                          signatureData: "",
                        }))
                      }
                      className={`flex-1 py-1.5 px-3 text-xs font-bold rounded border uppercase tracking-wider transition-all duration-150 ${
                        formData.signatureType === "draw"
                          ? "bg-fab-blue text-white border-fab-blue shadow-sm"
                          : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300"
                      }`}
                    >
                      🖋️ Draw Pad
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          signatureType: "upload",
                          signatureData: "",
                        }))
                      }
                      className={`flex-1 py-1.5 px-3 text-xs font-bold rounded border uppercase tracking-wider transition-all duration-150 ${
                        formData.signatureType === "upload"
                          ? "bg-fab-blue text-white border-fab-blue shadow-sm"
                          : "bg-white hover:bg-slate-100 text-slate-700 border-slate-300"
                      }`}
                    >
                      📁 Upload PNG
                    </button>
                  </div>

                  {formData.signatureType === "draw" ? (
                    <div className="bg-white border border-slate-300 rounded p-2 shadow-inner">
                      <div className="flex justify-between items-center mb-1.5 px-1">
                        <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
                          Sign Inside Border:
                        </span>
                        <button
                          type="button"
                          onClick={clearCanvas}
                          className="text-[10px] font-bold uppercase tracking-wider text-red-600 hover:text-red-800 transition-colors"
                        >
                          Reset Pad
                        </button>
                      </div>
                      <div className="border border-dashed border-slate-300 rounded overflow-hidden bg-slate-50">
                        <canvas
                          ref={canvasRef}
                          width={400}
                          height={120}
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                          className="w-full h-28 cursor-crosshair touch-none bg-white block"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white border border-slate-300 rounded p-3 flex flex-col items-center justify-center text-center h-[166px]">
                      {formData.signatureData ? (
                        <div className="flex flex-col items-center justify-between h-full w-full">
                          <div className="flex-1 flex items-center justify-center">
                            <img
                              src={formData.signatureData}
                              alt="Uploaded signature"
                              className="max-h-24 object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                signatureData: "",
                              }))
                            }
                            className="text-[10px] font-extrabold uppercase tracking-widest text-red-600 hover:text-red-800 transition-colors pt-2 border-t border-slate-100 w-full"
                          >
                            Remove and re-upload
                          </button>
                        </div>
                      ) : (
                        <div>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleSignatureUpload}
                            id="signature-file-uploader"
                            className="hidden"
                          />
                          <label
                            htmlFor="signature-file-uploader"
                            className="inline-block cursor-pointer px-4 py-2.5 bg-slate-100 border border-slate-300 hover:bg-slate-200 text-slate-700 hover:text-slate-900 rounded font-bold text-xs uppercase tracking-wider transition-colors shadow-sm"
                          >
                            Browse Signature
                          </label>
                          <p className="text-[10px] text-slate-400 mt-2.5 leading-normal max-w-xs mx-auto">
                            Import transparent signature png or black and white
                            sign-off file. Maximum size 2MB.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {!formData.signatureData && (
                    <div className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-2 animate-pulse flex items-center gap-1">
                      ⚠️ Awaiting signature sign-off before submission is
                      authorized
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Signature Row */}
          <div className="col-span-12 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800 h-auto md:h-24">
            <div className="flex flex-col justify-end p-2 pb-1 bg-white relative min-h-[96px]">
              {/* Display Signature overlay if available */}
              {formData.signatureData && (
                <div className="absolute top-1 left-23.5 -translate-x-12 md:left-1/2 md:-translate-x-1/2 h-14 flex items-center justify-center select-none pointer-events-none">
                  <img
                    src={formData.signatureData}
                    alt="Signature Drawing"
                    className="max-h-12 object-contain filter contrast-125"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}
              <div className="border-t border-black pt-1 mb-1 mt-12 md:mt-0 relative z-10 bg-white/75 text-center">
                <p className="font-bold text-[10px] uppercase tracking-wider select-none">
                  {formData.submitterName || "AWAITING SUBMISSION"}
                </p>
                <p className="font-bold text-[10px] text-center">
                  Ship's Owner Representative / Ship's Agent
                </p>
              </div>
              <div className="flex justify-between items-end text-[9px] italic text-slate-600 relative z-10 bg-white/75">
                <span>(Printed Name and Signature)</span>
                <span className="flex flex-col items-end">
                  <span className="text-[8px] text-slate-500 not-italic font-mono">
                    Time:{" "}
                    {(() => {
                      const dt = initialData?.createdAt ? new Date(initialData.createdAt) : new Date();
                      return !isNaN(dt.getTime())
                        ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                        : "-";
                    })()}
                  </span>
                  <span>
                    Date:{" "}
                    {formatDateTimeString(initialData?.createdAt || new Date())}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex flex-col justify-end p-2 pb-1 relative bg-white min-h-[96px]">
              <span className="absolute top-1 left-2 text-[9px] italic text-slate-600">
                Checked by:
              </span>
              {(initialData?.status === "Pending Approval" ||
                initialData?.status === "Approved") && (
                <>
                  {initialData?.checkedSignatureData ? (
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 h-14 flex items-center justify-center select-none pointer-events-none">
                      <img
                        src={initialData.checkedSignatureData}
                        alt="checker signature"
                        className="max-h-12 object-contain filter contrast-125"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
                      <span className="text-[10px] font-black uppercase text-green-700 tracking-wider bg-green-50 border border-green-300 px-1.5 py-0.5 rounded rotate-[-3deg] shadow-sm select-none">
                        ✓ DOCS VERIFIED
                      </span>
                      <span className="text-[7px] font-mono text-green-600 uppercase tracking-widest mt-0.5">
                        Port Services Div
                      </span>
                    </div>
                  )}
                </>
              )}
              <div className="border-t border-black pt-1 mb-1 mt-12 md:mt-0 relative z-10 bg-white/75 text-center">
                <p className="font-bold text-[10px] uppercase tracking-wider">
                  {initialData?.checkedByName ||
                    (initialData?.status === "Pending Approval" ||
                    initialData?.status === "Approved"
                      ? "AFAB Authorized Official"
                      : "")}
                </p>
                <p className="font-bold text-[10px] text-center">
                  AFAB Authorized Official
                </p>
              </div>
              <div className="flex justify-between items-end text-[9px] italic text-slate-600 relative z-10 bg-white/75">
                <span>(Printed Name and Signature)</span>
                <span className="flex flex-col items-end">
                  {initialData?.checkedAt && (
                    <span className="text-[8px] text-slate-500 not-italic font-mono">
                      Time:{" "}
                      {(() => {
                        const dt = new Date(initialData.checkedAt);
                        return !isNaN(dt.getTime())
                          ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                          : "-";
                      })()}
                    </span>
                  )}
                  <span>
                    Date:{" "}
                    {initialData?.checkedAt
                      ? formatDateTimeString(initialData.checkedAt)
                      : initialData?.status === "Pending Approval" ||
                          initialData?.status === "Approved"
                        ? "VERIFIED"
                        : ""}
                  </span>
                </span>
              </div>
            </div>

            <div className="flex flex-col justify-end p-2 pb-1 relative bg-white min-h-[96px]">
              <span className="absolute top-1 left-2 text-[9px] italic text-slate-600">
                Approved by:
              </span>
              {initialData?.status === "Approved" && (
                <>
                  {initialData?.approvedSignatureData ? (
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 h-14 flex items-center justify-center select-none pointer-events-none">
                      <img
                        src={initialData.approvedSignatureData}
                        alt="approver signature"
                        className="max-h-12 object-contain filter contrast-125"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center">
                      <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider bg-purple-50 border border-purple-300 px-1.5 py-0.5 rounded rotate-[-3deg] shadow-sm select-none">
                        ★ AFAB Authorized Official
                      </span>
                      <span className="text-[7px] font-mono text-purple-600 uppercase tracking-widest mt-0.5">
                        AFAB Port Services
                      </span>
                    </div>
                  )}
                </>
              )}
              <div className="border-t border-black pt-1 mb-1 mt-12 md:mt-0 relative z-10 bg-white/75 text-center">
                <p className="font-bold text-[10px] uppercase tracking-wider">
                  {initialData?.approvedByName ||
                    (initialData?.status === "Approved"
                      ? "AFAB Authorized Official"
                      : "")}
                </p>
                <p className="font-bold text-[10px] text-center">
                  AFAB Authorized Official
                </p>
              </div>
              <div className="flex justify-between items-end text-[9px] italic text-slate-600 relative z-10 bg-white/75">
                <span>(Printed Name and Signature)</span>
                <span className="flex flex-col items-end">
                  {initialData?.approvedAt && (
                    <span className="text-[8px] text-slate-500 not-italic font-mono">
                      Time:{" "}
                      {(() => {
                        const dt = new Date(initialData.approvedAt);
                        return !isNaN(dt.getTime())
                          ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
                          : "-";
                      })()}
                    </span>
                  )}
                  <span>
                    Date:{" "}
                    {initialData?.approvedAt
                      ? formatDateTimeString(initialData.approvedAt)
                      : initialData?.status === "Approved"
                        ? "DIGITALLY ISSUED"
                        : ""}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-2">
          <p className="text-[9px] text-right italic text-slate-600 leading-tight">
            PSD-FM-001
            <br />
            Rev.02 Date Effective 1 January 2023
          </p>
        </div>

        <div className="mt-8 flex flex-col items-end gap-2 print:hidden">
          <div className="flex justify-end gap-4 w-full sm:w-auto">
            <button
              type="button"
              onClick={onBack}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-3 rounded text-sm font-bold uppercase tracking-wider transition-colors border border-slate-200 cursor-pointer w-full sm:w-auto text-center"
            >
              Cancel / Back
            </button>
            {isEditMode && initialData?.status === "Approved" && (
              <button
                type="button"
                onClick={handleGeneratePDF}
                disabled={isGeneratingPDF}
                className="bg-slate-800 text-white px-8 py-3 rounded text-sm font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-slate-900 transition-colors shadow-sm disabled:opacity-70 group relative cursor-pointer"
              >
                {isGeneratingPDF ? (
                  <span className="animate-pulse">Loading...</span>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Print Permit
                  </>
                )}
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-fab-blue text-white px-8 py-3 rounded text-sm font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-blue-900 transition-colors shadow-sm disabled:opacity-70 w-full sm:w-auto justify-center cursor-pointer"
            >
              {isSubmitting ? (
                <span className="animate-pulse">Processing...</span>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {isEditMode ? "Save Changes" : "Submit Entry Permit"}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
