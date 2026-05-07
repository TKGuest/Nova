export interface PageModel {
  id: string;
  title: string;
  type: 'note' | 'habit';
  createdAt: number;
  isFavorite?: boolean;
  content?: string;
  coverImage?: {
    url: string;
    type: 'preset' | 'upload';
    position?: number;
  };
  defaultRecordCover?: {
    url: string;
    type: 'preset' | 'upload';
    position?: number;
  };
}
