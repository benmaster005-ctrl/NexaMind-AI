"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { Icon } from "@/components/ui/icon";
import { uploadResourceAction } from "@/app/(dashboard)/documents/actions";
import { RESOURCE_CATEGORIES, MAX_UPLOAD_BYTES } from "@/lib/resources/validation";
import styles from "./workspace.module.css";

interface ResourceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newDocTitle: string, newDocCategory: string) => Promise<void>;
}

type UploadStep = "idle" | "uploading" | "processing" | "indexing" | "ready" | "error";

export default function ResourceUploadModal({
  isOpen,
  onClose,
  onSuccess,
}: ResourceUploadModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(RESOURCE_CATEGORIES[0]);
  const [visibility, setVisibility] = useState<"Personnel" | "Équipe" | "Entreprise">("Entreprise");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState<UploadStep>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = e.dataTransfer.files[0];
      validateAndSetFile(dropped);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selected: File) => {
    setErrorMessage(null);
    const ext = selected.name.slice(selected.name.lastIndexOf(".")).toLowerCase();
    if (![".pdf", ".docx", ".txt", ".md"].includes(ext)) {
      setErrorMessage("Format non supporté. Choisissez un fichier PDF, DOCX, TXT ou MD.");
      return;
    }
    if (selected.size > MAX_UPLOAD_BYTES) {
      setErrorMessage("Fichier trop lourd : la taille maximale est de 4 Mo.");
      return;
    }
    setFile(selected);
    if (!title.trim()) {
      // Préremplir le titre avec le nom du fichier sans extension
      const nameWithoutExt = selected.name.slice(0, selected.name.lastIndexOf("."));
      setTitle(nameWithoutExt);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage("Veuillez saisir un titre pour le document.");
      return;
    }
    if (!file) {
      setErrorMessage("Veuillez sélectionner un fichier à déposer.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setStep("uploading");

    try {
      const formData = new FormData();
      formData.set("title", title.trim());
      formData.set("category", category);
      const combinedTags = [visibility.toLowerCase(), ...tags.split(",").map((t) => t.trim())]
        .filter(Boolean)
        .join(",");
      formData.set("tags", combinedTags);
      formData.set("file", file);

      // Simulation d'étapes d'ingestion/indexation pour la transparence utilisateur
      setTimeout(() => {
        setStep((current) => (current === "uploading" ? "processing" : current));
      }, 700);

      setTimeout(() => {
        setStep((current) => (current === "processing" ? "indexing" : current));
      }, 1500);

      const result = await uploadResourceAction(formData);

      if (result.success) {
        setStep("ready");
        setSuccessMessage(result.message);
        await onSuccess(title.trim(), category);
        setTimeout(() => {
          onClose();
          resetForm();
        }, 1200);
      } else {
        setStep("error");
        setErrorMessage(result.message);
      }
    } catch {
      setStep("error");
      setErrorMessage("Erreur technique de connexion au serveur.");
    }
  };

  const resetForm = () => {
    setTitle("");
    setCategory(RESOURCE_CATEGORIES[0]);
    setVisibility("Entreprise");
    setTags("");
    setFile(null);
    setStep("idle");
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const isPending = step === "uploading" || step === "processing" || step === "indexing";

  return (
    <div
      className={styles.dialogBackdrop}
      onClick={(e) => {
        if (!isPending && e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className={styles.uploadModal}
        role="dialog"
        aria-modal="true"
        aria-label="Ajouter une ressource"
      >
        <div className={styles.uploadHeader}>
          <h2 className={styles.uploadTitle}>Ajouter une ressource</h2>
          <button
            type="button"
            className={styles.iconControl}
            onClick={onClose}
            disabled={isPending}
            aria-label="Fermer"
          >
            <Icon name="close" />
          </button>
        </div>

        <form className={styles.uploadForm} onSubmit={handleSubmit}>
          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor="resource-title">
              Nom du document
            </label>
            <input
              id="resource-title"
              type="text"
              className={styles.formInput}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Guide onboarding 2026"
              required
              disabled={isPending}
              maxLength={200}
            />
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor="resource-category">
              Catégorie
            </label>
            <select
              id="resource-category"
              className={styles.formSelect}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isPending}
            >
              {RESOURCE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor="resource-visibility">
              Visibilité
            </label>
            <select
              id="resource-visibility"
              className={styles.formSelect}
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "Personnel" | "Équipe" | "Entreprise")}
              disabled={isPending}
            >
              <option value="Entreprise">Entreprise (Tous les collaborateurs)</option>
              <option value="Équipe">Équipe</option>
              <option value="Personnel">Personnel (Mes documents)</option>
            </select>
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel} htmlFor="resource-tags">
              Étiquettes (optionnel, séparées par des virgules)
            </label>
            <input
              id="resource-tags"
              type="text"
              className={styles.formInput}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="rh, procédure, q4"
              disabled={isPending}
            />
          </div>

          <div className={styles.formField}>
            <label className={styles.formLabel}>Fichier</label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.docx,.txt,.md"
              className={styles.fileHiddenInput}
              disabled={isPending}
            />
            <div
              className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  fileInputRef.current?.click();
                }
              }}
            >
              <Icon name="upload" />
              {file ? (
                <div className={styles.fileInfoBox}>
                  <div className={styles.fileInfoName}>{file.name}</div>
                  <div className={styles.dropZoneFormats}>{formatFileSize(file.size)}</div>
                </div>
              ) : (
                <>
                  <p className={styles.dropZoneText}>
                    Glissez-déposez votre fichier ici ou <u>Sélectionner un fichier</u>
                  </p>
                  <p className={styles.dropZoneFormats}>
                    Formats acceptés : PDF, DOCX, TXT, MD (4 Mo max)
                  </p>
                </>
              )}
            </div>
          </div>

          {/* États d'avancement */}
          {step === "uploading" ? (
            <div className={`${styles.uploadProgressState} ${styles.stateUploading}`}>
              1/3 Téléversement du document vers Supabase Storage…
            </div>
          ) : step === "processing" ? (
            <div className={`${styles.uploadProgressState} ${styles.stateUploading}`}>
              2/3 Extraction du texte et découpage en morceaux…
            </div>
          ) : step === "indexing" ? (
            <div className={`${styles.uploadProgressState} ${styles.stateUploading}`}>
              3/3 Vectorisation sémantique avec Google Gemini…
            </div>
          ) : step === "ready" ? (
            <div className={`${styles.uploadProgressState} ${styles.stateSuccess}`}>
              ✓ {successMessage || "Document déposé et indexé avec succès !"}
            </div>
          ) : errorMessage ? (
            <div className={`${styles.uploadProgressState} ${styles.stateError}`}>
              ✕ {errorMessage}
            </div>
          ) : null}

          <button
            type="submit"
            className={styles.uploadSubmitAction}
            disabled={isPending || !file || !title.trim()}
          >
            {isPending ? "Traitement en cours…" : "Déposer le document"}
          </button>
        </form>
      </div>
    </div>
  );
}
