
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

// Drawings types

// View object returned from api/appelements/d/did/wv/wvid/e/eid/views/ API
export interface View1 {
  associativityChangeId: string;
  bomReferenceId: string;
  brokenOutBBoxes: Object;
  brokenOutEndConditions: [];
  brokenOutPointNumbers: [];
  computeIntersection: boolean;
  cutPoint: [];
  displayStateId: string;
  errorCode: number;
  explodedViewId: string;
  hiddenLines: string;
  ignoreFaultyParts: boolean;
  includeHiddenInstances: boolean;
  includeSurfaces: boolean;
  includeWires: boolean;
  isAlignedSection: boolean;
  isBrokenOutSection: boolean;
  isCopiedView: boolean;
  isCropView: boolean;
  isPartialSection: boolean;
  isSectionOfAlignedSection: boolean;
  isSectionOfSectionOnBase: boolean;
  isSurface: boolean;
  modelReferenceId: string;
  modificationId: string;
  namedPositionId: string;
  occurrenceOrQueryToGeometryProperties: Object;
  offsetSectionPoints: [];
  parentViewId: string;
  perspective: boolean;
  projectionAngle: string;
  qualityOption: number;
  renderSketches: boolean;
  showAutoCenterlines: boolean;
  showAutoCentermarks: boolean;
  showCutGeomOnly: boolean;
  showTangentLines: boolean;
  showThreads: boolean;
  showViewingPlane: boolean;
  sectionId: string;
  simplificationOption: number;
  simplificationThreshold: number;
  useParentViewSectionData: boolean;
  viewDirection: [];
  viewId: string;
  viewMatrix: number[];
  viewVersion: number;
}

export interface GetDrawingViewsResponse {
  items: View1[];
}

// View object returned from api/drawings/d/did/wv/wvid/e/eid/translations API with DRAWING_JSON format
export interface View2 {
  bomReference: string;
  label: string;
  name: string;
  orientation: string;
  position: {
    x: number;
    y: number;
  };
  renderMode: string;
  rotation: number;
  scale: {
    denumerator: number;
    numerator: number;
    scaleSource: string;
  };
  sheet: string;
  showScaleLabel: boolean;
  simplification: string;
  tangentEdges: string;
  type: string;
  viewId: string;
  viewToPaperMatrix: {
    items: number[];
  };
}

// Response from api/drawings/d/did/wv/wvid/e/eid/translations API
export interface ExportDrawingResponse {
  failureReason: string;
  id: string;
  requestState: string;
}

export interface TranslationStatusResponse {
  failureReason: string;
  id: string;
  requestState: string;
  resultExternalDataIds: string[];
}

export interface EdgeData {
  center?: number[];
  axisDir?: number[];
  radius?: number;
  start?: number[];
  end?: number[];
}

export interface Edge {
  type: string;
  visible: boolean;
  deterministicId: string;
  rightRepOccurrences: string[];
  uniqueId: string;
  geometryClass: string;
  data: EdgeData;
}

export interface GetViewJsonGeometryResponse {
  bodyData: Edge[];
}

export interface Sheet {
  active: boolean;
  annotations: Object[];
  format: string;
  index: number;
  name: string;
  reference: string;
  scale: {
    denumerator: number,
    numerator: number
  };
  size: string;
  views: View2[];
}

export interface GetDrawingJsonExportResponse {
  sheets: Sheet[];
}