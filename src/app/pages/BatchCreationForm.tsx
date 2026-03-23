import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { DashboardLayout } from "../components/DashboardLayout";
import { TCInput } from "../components/TCInput";
import { TCSelect } from "../components/TCSelect";
import { TCButton } from "../components/TCButton";
import { MassBalanceIndicator } from "../components/MassBalanceIndicator";
import { createBatch } from "../lib/api";

const materialLots = [
  { id: "LOT-OLV-2026-001", name: "Coratina Olives", available: 700, total: 2500, unit: "kg" },
  { id: "LOT-LMN-2026-003", name: "Amalfi Lemons", available: 100, total: 1000, unit: "kg" },
  { id: "LOT-BLS-2026-002", name: "Trebbiano Grape Must", available: 400, total: 600, unit: "L" },
  { id: "LOT-TRF-2026-004", name: "Black Truffle Extract", available: 50, total: 400, unit: "kg" },
];

export function BatchCreationForm() {
  const navigate = useNavigate();
  const [productName, setProductName] = useState("");
  const [selectedLot, setSelectedLot] = useState("");
  const [quantity, setQuantity] = useState("");
  const [batchSize, setBatchSize] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [balanceWarning, setBalanceWarning] = useState("");
  const [successBatchId, setSuccessBatchId] = useState("");

  const selectedMaterial = materialLots.find((l) => l.id === selectedLot);

  const validateBalance = (qty: string) => {
    if (!selectedMaterial || !qty) {
      setBalanceWarning("");
      return;
    }
    const numQty = parseFloat(qty);
    if (numQty > selectedMaterial.available) {
      setBalanceWarning(
        `Insufficient material: requesting ${numQty} ${selectedMaterial.unit} but only ${selectedMaterial.available} ${selectedMaterial.unit} available in ${selectedMaterial.id}`
      );
    } else if (numQty > selectedMaterial.available * 0.8) {
      setBalanceWarning(
        `Warning: This will use ${((numQty / selectedMaterial.available) * 100).toFixed(0)}% of remaining stock in ${selectedMaterial.id}`
      );
    } else {
      setBalanceWarning("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!productName.trim()) newErrors.productName = "Product name is required";
    if (!selectedLot) newErrors.lot = "Select a raw material lot";
    if (!quantity || parseFloat(quantity) <= 0) newErrors.quantity = "Valid quantity required";
    if (!batchSize || parseInt(batchSize) <= 0) newErrors.batchSize = "Valid batch size required";

    if (selectedMaterial && parseFloat(quantity) > selectedMaterial.available) {
      newErrors.quantity = `Exceeds available stock (${selectedMaterial.available} ${selectedMaterial.unit})`;
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    // Try real API first, fall back to local ID generation
    try {
      const lotId = parseInt(selectedLot.replace(/\D/g, "")) || 1;
      const result = await createBatch({
        name: productName,
        description: "",
        batch_size: parseInt(batchSize),
        expires_days: 365,
        rm_lot_id: lotId,
        qty_used: parseFloat(quantity),
      });
      setSuccessBatchId(`BATCH-${result.batch_id}`);
    } catch {
      // Backend not available — generate local ID for demo
      const batchId = `BATCH-MHC-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      setSuccessBatchId(batchId);
    }

    setSubmitted(true);
  };

  if (submitted && successBatchId) {
    return (
      <DashboardLayout role="manufacturer">
        <div className="flex flex-col items-center justify-center py-16">
          <div
            className="w-[64px] h-[64px] rounded-full flex items-center justify-center mb-6"
            style={{
              backgroundColor: "rgba(0, 255, 148, 0.1)",
              border: "2px solid var(--trust-green)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 13l4 4L19 7"
                stroke="var(--trust-green)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="24"
                strokeDashoffset="0"
                style={{ animation: "draw-check 400ms ease-out" }}
              />
            </svg>
          </div>

          <h1
            className="font-syne text-center"
            style={{ fontSize: "24px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}
          >
            Batch Created Successfully
          </h1>

          <p
            className="font-syne-mono mt-3"
            style={{ fontSize: "14px", color: "var(--accent-cyan)" }}
          >
            {successBatchId}
          </p>

          <div
            className="mt-6 p-4 rounded-[4px] max-w-[400px] w-full"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--tc-border)",
            }}
          >
            <div className="flex flex-col gap-2">
              <MetaRow label="Product" value={productName} />
              <MetaRow label="Material Lot" value={selectedLot} />
              <MetaRow label="Quantity" value={`${quantity} ${selectedMaterial?.unit || ""}`} />
              <MetaRow label="Batch Size" value={`${batchSize} units`} />
              <MetaRow label="Status" value="PENDING QR GENERATION" highlight />
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <TCButton
              variant="primary"
              onClick={() => {
                setSubmitted(false);
                setSuccessBatchId("");
                setProductName("");
                setSelectedLot("");
                setQuantity("");
                setBatchSize("");
              }}
            >
              Create Another
            </TCButton>
            <TCButton
              variant="ghost"
              onClick={() => navigate("/dashboard/manufacturer")}
            >
              Back to Dashboard
            </TCButton>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="manufacturer">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate("/dashboard/manufacturer")}
          className="p-2 rounded-[4px] cursor-pointer transition-colors duration-150"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1
            className="font-syne"
            style={{ fontSize: "28px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", lineHeight: 1.2 }}
          >
            Create New Batch
          </h1>
          <p
            className="font-mono-ibm mt-1"
            style={{ fontSize: "13px", color: "var(--text-secondary)" }}
          >
            Register a new production batch with raw material allocation
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 max-w-[600px]">
          <div
            className="p-6 rounded-[4px]"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--tc-border)",
            }}
          >
            <div className="flex flex-col gap-6">
              <TCInput
                label="Product Name"
                placeholder="e.g. Organic Extra Virgin Olive Oil"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                error={errors.productName}
              />

              <TCSelect
                label="Raw Material Lot"
                placeholder="Select material lot..."
                value={selectedLot}
                onChange={(e) => {
                  setSelectedLot(e.target.value);
                  validateBalance(quantity);
                }}
                options={materialLots.map((l) => ({
                  value: l.id,
                  label: `${l.name} — ${l.available} ${l.unit} available (${l.id})`,
                }))}
                error={errors.lot}
              />

              {/* Mass balance display */}
              {selectedMaterial && (
                <div
                  className="p-4 rounded-[4px]"
                  style={{
                    backgroundColor: "var(--bg-raised)",
                    border: "1px solid var(--tc-border)",
                  }}
                >
                  <span
                    className="font-mono-ibm block mb-3 uppercase tracking-[0.15em]"
                    style={{ fontSize: "10px", color: "var(--text-dim)" }}
                  >
                    Mass Balance Ledger — {selectedMaterial.id}
                  </span>
                  <MassBalanceIndicator
                    total={selectedMaterial.total}
                    used={selectedMaterial.total - selectedMaterial.available}
                    unit={selectedMaterial.unit}
                    label={selectedMaterial.name}
                  />
                </div>
              )}

              <TCInput
                label="Material Quantity"
                type="number"
                placeholder="0"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  validateBalance(e.target.value);
                }}
                error={errors.quantity}
              />

              {balanceWarning && (
                <div
                  className="flex items-start gap-3 p-3 rounded-[4px]"
                  style={{
                    backgroundColor: "rgba(255, 149, 0, 0.05)",
                    border: "1px solid rgba(255, 149, 0, 0.2)",
                  }}
                >
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "var(--trust-orange)" }} />
                  <span
                    className="font-mono-ibm"
                    style={{ fontSize: "12px", color: "var(--trust-orange)", lineHeight: 1.5 }}
                  >
                    {balanceWarning}
                  </span>
                </div>
              )}

              <TCInput
                label="Batch Size (Units)"
                type="number"
                placeholder="Number of units in this batch"
                value={batchSize}
                onChange={(e) => setBatchSize(e.target.value)}
                error={errors.batchSize}
              />

              <div className="pt-2">
                <TCButton type="submit" variant="primary" fullWidth>
                  Create Batch & Generate QR Codes
                </TCButton>
              </div>
            </div>
          </div>
        </form>

        {/* Sidebar info */}
        <div className="w-full lg:w-[280px] flex-shrink-0">
          <div
            className="p-4 rounded-[4px]"
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--tc-border)",
            }}
          >
            <span
              className="font-mono-ibm block mb-3 uppercase tracking-[0.15em]"
              style={{ fontSize: "10px", color: "var(--text-dim)" }}
            >
              Batch Creation Guide
            </span>
            <div className="flex flex-col gap-3">
              <InfoStep number="01" text="Select the raw material lot to allocate" />
              <InfoStep number="02" text="Specify the quantity of material required" />
              <InfoStep number="03" text="Mass balance is checked automatically" />
              <InfoStep number="04" text="QR codes are generated for each unit" />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function MetaRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span
        className="font-mono-ibm uppercase tracking-[0.1em]"
        style={{ fontSize: "10px", color: "var(--text-dim)" }}
      >
        {label}
      </span>
      <span
        className="font-mono-ibm"
        style={{
          fontSize: "12px",
          color: highlight ? "var(--accent-cyan)" : "var(--text-secondary)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function InfoStep({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="font-syne-mono flex-shrink-0"
        style={{ fontSize: "11px", color: "var(--accent-cyan)" }}
      >
        {number}
      </span>
      <span
        className="font-mono-ibm"
        style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}
      >
        {text}
      </span>
    </div>
  );
}
