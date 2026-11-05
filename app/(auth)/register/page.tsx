import type { Metadata } from "next";
import Link from "next/link";
import Brand from "@/components/dashboard/brand";
import RegisterForm from "@/components/auth/register-form";
import { Icon } from "@/components/ui/icon";
import styles from "@/components/auth/auth.module.css";

export const metadata: Metadata = {
  title: "Créer un compte — NexaMind AI",
  description:
    "Créez votre compte NexaMind AI, le copilote documentaire intelligent de NexaWorks.",
};

export default function RegisterPage() {
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
          <h1 className={styles.title}>Créer un compte</h1>
          <p className={styles.subtitle}>
            Rejoignez l&apos;espace documentaire intelligent de NexaWorks
          </p>
        </div>

        <RegisterForm />
      </div>

      <footer className={styles.authFooter}>
        <span>&copy; {new Date().getFullYear()} NexaWorks</span>
        <span>•</span>
        <Link href="/docs">Guide d&apos;utilisation</Link>
      </footer>
    </main>
  );
}
