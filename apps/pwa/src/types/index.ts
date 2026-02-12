export type OrderStatus = 'NEW' | 'PROCESSING' | 'READY_FOR_PRINT' | 'COMPLETED' | 'ERROR';
export type AIStatus = 'PENDING' | 'PARSED' | 'REVIEW_REQUIRED' | 'FAILED';

export interface User {
    id: string;
    name: string;
    email: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'VIEWER';
}

export interface Order {
    id: string;
    wooId: string;
    customerName: string;
    templateKey: string; // e.g., JSO 15
    status: OrderStatus;
    aiStatus: AIStatus;
    createdAt: string;
    updatedAt: string;
    items: OrderItem[];
}

export interface OrderItem {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    extractedOptions: Record<string, any>; // From EPO
}

export interface Template {
    key: string; // JSO 15
    displayName: string;
    dropboxPath: string;
    layerMapping: Record<string, string>; // { "Layer 1": "NAME_MAIN" }
    invitationAttached: boolean; // Flag if _P.psd should be added
}
