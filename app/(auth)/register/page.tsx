import type { Metadata } from "next";

import RegisterForm from "@/components/auth/register-form";
import styles from "@/components/auth/auth.module.css";

export const metadata: Metadata = {
  title: "Créer un compte — NexaMind AI",
  description:
    "Créez votre compte NexaMind AI, le copilote métier interne de NexaWorks.",
};

export default function RegisterPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>NexaMind AI</h1>
        <p className={styles.subtitle}>Créez votre compte</p>
        <RegisterForm />
      </div>
    </main>
  );
}
