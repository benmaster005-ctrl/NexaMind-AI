import type { Metadata } from "next";

import LoginForm from "@/components/auth/login-form";
import styles from "@/components/auth/auth.module.css";

export const metadata: Metadata = {
  title: "Connexion — NexaMind AI",
  description:
    "Connectez-vous à NexaMind AI, le copilote métier interne de NexaWorks.",
};

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>NexaMind AI</h1>
        <p className={styles.subtitle}>Connectez-vous à votre espace</p>
        <LoginForm />
      </div>
    </main>
  );
}
