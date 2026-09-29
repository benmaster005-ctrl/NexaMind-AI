"use client";

/**
 * Zone compte de l'en-tete du tableau de bord (refonte 2026-09-29) :
 * avatar, nom du compte connecte et deconnexion directe.
 *
 * Le libelle est derive de l'adresse reelle (`displayNameFromEmail`), jamais
 * d'une donnee fictive, et l'avatar est dessine (initiales) — aucune image
 * distante. La deconnexion reutilise `SignOutButton`, donc `signOutAction`
 * (invalidation de session cote serveur), en icone ronde : elle reste visible
 * sans ouvrir de menu, donc atteignable en un clic et au clavier.
 *
 * L'adresse complete n'est plus affichee dans un panneau : elle reste
 * consultable en infobulle sur le nom (attribut `title`).
 */
import { displayNameFromEmail, initialsFromName } from "@/lib/dashboard/helpers";
import { Icon } from "@/components/ui/icon";
import SignOutButton from "./signout-button";
import styles from "./dashboard-home.module.css";

interface UserBlockProps {
  /** Adresse du compte connecte (jamais vide : la route est gardee). */
  email: string;
}

export default function UserBlock({ email }: UserBlockProps) {
  const name = displayNameFromEmail(email);

  return (
    <div className={styles.account}>
      <span className={styles.accountAvatar} aria-hidden="true">
        {initialsFromName(name)}
      </span>
      <span className={styles.accountName} title={email}>
        {name}
      </span>
      <SignOutButton plain className={styles.accountSignOut}>
        <Icon name="logout" className={styles.accountSignOutIcon} />
        <span className={styles.visuallyHidden}>Se déconnecter</span>
      </SignOutButton>
    </div>
  );
}
