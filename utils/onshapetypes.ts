
export interface BasicNode {
  id: string;
  name?: string;
  description?: string;
  href?: string;
}

export interface NodeOwner extends BasicNode {
  type: number;
}

export interface CompanyInfo extends BasicNode {
  admin: boolean;
  domainPrefix?: string;
}

export const DOCUMENT_SUMMARY = 'document-summary';
export const FOLDER = 'folder';
export type JsonType = 'document-summary' | 'folder';

export interface GlobalNode extends BasicNode {
  jsonType?: JsonType;
  owner?: NodeOwner;
  createdBy?: NodeOwner;
  modifiedBy?: NodeOwner;
}

export interface DocumentNode extends GlobalNode {
  defaultWorkspace?: BasicNode;
  parentId?: string;
}

export interface AElementExtRef {
  documentId?: string;
  versionId?: string;
  id?: string;
}

export interface WorkspaceRef {
  documents?: BasicNode[];
  elementExternalReferences?: Record<string, AElementExtRef[]>;
  elementRevisionReferences?: Record<string, AElementExtRef[]>;
}

export interface ListResponse<Type> {
  previous?: string;
  next?: string;
  href?: string;
  items?: Type[];
}

export interface GlobalNodeList extends ListResponse<GlobalNode & Record<string, string | number | boolean>> {
}

export interface Revision extends BasicNode {
  partNumber: string;
  revision: string;
  companyId: string;
  documentId: string;
  versionId: string;
  elementId: string;
  partId?: string;
  elementType: ElementType;
  configuration?: string;
  mimeType?: string;
  createdAt?: string;
  viewRef?: string;
}

export enum ElementType {
  PARTSTUDIO,
  ASSEMBLY,
  DRAWING,
  FEATURESTUDIO,
  BLOB,
  APPLICATION,
  TABLE,
  BILLOFMATERIALS,
  UNKNOWN
}

export class Constants {
  static ONSHAPE_WORKFLOW_ID = '59b944bcd71eb79518f2176c';
  static RP_NAME_ID = '594964b7040fc85d2b418138';
  static RP_NOTES_ID = '594964df040fc85d2b418144';
  static RP_COMMENT_ID = '594964df040fc85d2b418145';
  static INCLUDED_IN_RELEASE_PACKAGE_PROPERTY_ID = '59496ecb040fc85d2b41839c';
  static PROPERTY_ID_PREVIOUS_REVISION = '59496726040fc85d2b4181be';
  static NOT_REVISION_MANAGED_ID = '57f3fb8efa3416c06701d61d';
  static PART_NUMBER_ID = '57f3fb8efa3416c06701d60f';
  static NAME_ID = '57f3fb8efa3416c06701d60d';
  static STATE_ID = '57f3fb8efa3416c06701d611';
  static REVISION_ID = '57f3fb8efa3416c06701d610';
}

export interface MetadataProperty {
  propertyId: string;
  editable: boolean;
  value: string | number | boolean;
  defaultValue: string | number | boolean;
}

export interface ElementMetadata {
  parts?: { items?: Record<string, string>[] };
  href: string;
  mimeType?: string;
  elementType: ElementType;
  properties: MetadataProperty[];
}

export enum ErrorSeverity {
  OK,
  INFO,
  WARNING,
  ERROR
}

export interface ReleaseItemErrors {
  message: string;
  severity: ErrorSeverity;
}

export interface ReleasePackageItem extends BasicNode {
  documentId?: string;
  workspaceId?: string;
  versionId?: string;
  elementId: string;
  partId?: string;
  viewRef?: string;
  children: ReleasePackageItem[];
  errors: ReleaseItemErrors[];
  properties: MetadataProperty[];
}

export interface ReleasePackage extends BasicNode {
  properties: MetadataProperty[];
  items: ReleasePackageItem[];
  documentId: string;
}

export type PROPERTY_TYPES = string | number | boolean;

export interface PropertyUpdate {
  propertyId: string;
  value: PROPERTY_TYPES;
}

export interface ReleasePackageItemUpdate {
  id: string;
  href: string;
  documentId: string;
  workspaceId?: string;
  versionId?: string;
  elementId: string;
  properties: PropertyUpdate[];
}
