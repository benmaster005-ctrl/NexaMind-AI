"use client";

import styles from "./workspace.module.css";

interface CategoryBarProps {
  categories: Array<{ name: string; count: number }>;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  totalDocumentsCount: number;
}

export default function CategoryBar({
  categories,
  selectedCategory,
  onSelectCategory,
  totalDocumentsCount,
}: CategoryBarProps) {
  const isAllActive = selectedCategory === "Toutes";

  return (
    <div className={styles.categoryBar} role="navigation" aria-label="Catégories de documents">
      <ul className={styles.categoryList}>
        <li>
          <button
            type="button"
            className={`${styles.categoryItem} ${isAllActive ? styles.categoryItemActive : ""}`}
            onClick={() => onSelectCategory("Toutes")}
            aria-current={isAllActive ? "page" : undefined}
          >
            <span>Toutes</span>
            <span className={styles.categoryBadge}>{totalDocumentsCount}</span>
          </button>
        </li>
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.name;
          return (
            <li key={cat.name}>
              <button
                type="button"
                className={`${styles.categoryItem} ${isActive ? styles.categoryItemActive : ""}`}
                onClick={() => onSelectCategory(cat.name)}
                aria-current={isActive ? "page" : undefined}
              >
                <span>{cat.name}</span>
                <span className={styles.categoryBadge}>{cat.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
