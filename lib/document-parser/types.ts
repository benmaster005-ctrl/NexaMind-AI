/**
 * Types pour la représentation structurée des documents extraits (Knowledge Document Page).
 */

export interface DocumentMetadataItem {
  key: string;
  label: string;
  value: string;
}

export interface TocItem {
  id: string;
  title: string;
  level: 2 | 3;
}

export type BlockType = "paragraph" | "qa" | "list" | "table" | "callout" | "divider";

export interface BaseBlock {
  id: string;
  type: BlockType;
  chunkId?: string;
  isActive?: boolean;
}

export interface ParagraphBlock extends BaseBlock {
  type: "paragraph";
  text: string;
}

export interface QaBlock extends BaseBlock {
  type: "qa";
  question: string;
  answer: string;
}

export interface ListBlock extends BaseBlock {
  type: "list";
  items: string[];
  ordered: boolean;
}

export interface TableBlock extends BaseBlock {
  type: "table";
  headers: string[];
  rows: string[][];
}

export interface CalloutBlock extends BaseBlock {
  type: "callout";
  text: string;
  variant: "info" | "warning" | "tip";
}

export interface DividerBlock extends BaseBlock {
  type: "divider";
}

export type StructuredBlock =
  | ParagraphBlock
  | QaBlock
  | ListBlock
  | TableBlock
  | CalloutBlock
  | DividerBlock;

export interface StructuredSection {
  id: string;
  number?: string;
  title: string;
  level: 2 | 3;
  chunkId?: string;
  isActive?: boolean;
  blocks: StructuredBlock[];
}

export interface StructuredDocument {
  title: string;
  surtitle?: string;
  subtitle?: string;
  metadata: DocumentMetadataItem[];
  tableOfContents: TocItem[];
  sections: StructuredSection[];
  isFaq: boolean;
  totalChars: number;
}
