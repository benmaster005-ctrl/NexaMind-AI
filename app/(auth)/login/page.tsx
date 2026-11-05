import type { Metadata } from "next";
import Link from "next/link";
import Brand from "@/components/dashboard/brand";
import LoginForm from "@/components/auth/login-form";
import { Icon } from "@/components/ui/icon";
import styles from "@/components/auth/auth.module.css";

export const metadata: Metadata = {
  title: "Connexion — NexaMind AI",
  description:
    "Connectez-vous à NexaMind AI, le copilote documentaire intelligent de NexaWorks.",
};

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <Brand />
        <Link href="/docs" className={styles.docsLink}>
          <Icon name="book" />
          <span>Documentation</span>
        </Link>
      </header>

      <div className={styles.card}>
        <div className={styles.brandHeader}>
          <div className={styles.brandLogoWrapper}>
            <Brand />
          </div>
          <h1 className={styles.title}>Bon retour parmi nous</h1>
          <p className={styles.subtitle}>
            Accédez à vos documents et à votre copilote IA
          </p>
        </div>

        <LoginForm />
      </div>

      <footer className={styles.authFooter}>
        <span>&copy; {new Date().getFullYear()} NexaWorks</span>
        <span>•</span>
        <Link href="/docs">Guide d&apos;utilisation</Link>
      </footer>
    </main>
  );
}
