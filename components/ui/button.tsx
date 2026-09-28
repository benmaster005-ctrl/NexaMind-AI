/**
 * Bouton du socle (story 7.1) : 4 roles visuels, une seule recette chacun.
 *
 * `buttonClass()` sert aux actions rendues en `<Link>` (navigation), `Button`
 * aux actions en `<button>`. Composants sans etat : utilisables depuis un
 * Server Component.
 */
import styles from "./ui.module.css";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

/** Classe CSS d'un role de bouton, a poser sur un `<Link>` ou un `<button>`. */
export function buttonClass(
  variant: ButtonVariant = "secondary",
  extra?: string,
): string {
  const byVariant: Record<ButtonVariant, string> = {
    primary: styles.buttonPrimary,
    secondary: styles.buttonSecondary,
    danger: styles.buttonDanger,
    ghost: styles.buttonGhost,
  };
  return [styles.button, byVariant[variant], extra].filter(Boolean).join(" ");
}

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = "secondary", className, ...rest }: ButtonProps) {
  return <button className={buttonClass(variant, className)} {...rest} />;
}

export default Button;
