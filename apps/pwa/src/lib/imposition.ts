export interface Dimensions {
    width: number;  // mm
    height: number; // mm
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface SheetLayout {
    sheetWidth: number;
    sheetHeight: number;
    rows: number;
    cols: number;
    itemsPerSheet: number;
    totalSheets: number;
    items: Rect[]; // Coordinates for one sheet
    waste: number; // Percentage
}

// Standard Paper Sizes
export const PAPER_SIZES = {
    SRA3: { width: 320, height: 450 },
    A3: { width: 297, height: 420 },
    A4: { width: 210, height: 297 }
};

// Bleed config
const BLEED = 2; // 2mm bleed

/**
 * Calculates the N-up layout for items on a sheet.
 * Tries both orientations (Portrait/Landscape) to find best fit.
 */
export function calculateImposition(
    canvas: Dimensions,
    item: Dimensions,
    totalItems: number,
    gap: number = 0 // gap between items (usually 0 if bleed is included in item size, or >0 for cutters)
): SheetLayout {
    // 1. Calculate for Orientation A (Portrait item on Portrait canvas)
    const layoutA = getBestFit(canvas, item, gap);

    // 2. Calculate for Orientation B (Rotated item)
    const rotatedItem = { width: item.height, height: item.width };
    const layoutB = getBestFit(canvas, rotatedItem, gap);

    // Choose the one with more items per sheet
    const bestLayout = (layoutB.rows * layoutB.cols) > (layoutA.rows * layoutA.cols) ? layoutB : layoutA;

    const itemsPerSheet = bestLayout.rows * bestLayout.cols;
    const totalSheets = Math.ceil(totalItems / itemsPerSheet);

    // Generate coordinates for one sheet
    const items: Rect[] = [];
    const startX = (canvas.width - (bestLayout.cols * item.width + (bestLayout.cols - 1) * gap)) / 2;
    const startY = (canvas.height - (bestLayout.rows * item.height + (bestLayout.rows - 1) * gap)) / 2;

    for (let r = 0; r < bestLayout.rows; r++) {
        for (let c = 0; c < bestLayout.cols; c++) {
            items.push({
                x: startX + c * (item.width + gap),
                y: startY + r * (item.height + gap),
                width: item.width,
                height: item.height
            });
        }
    }

    return {
        sheetWidth: canvas.width,
        sheetHeight: canvas.height,
        rows: bestLayout.rows,
        cols: bestLayout.cols,
        itemsPerSheet,
        totalSheets,
        items,
        waste: 0 // Todo: calculate area waste
    };
}

function getBestFit(canvas: Dimensions, item: Dimensions, gap: number) {
    // Simple grid calculation
    // Available space
    const cols = Math.floor((canvas.width + gap) / (item.width + gap));
    const rows = Math.floor((canvas.height + gap) / (item.height + gap));

    return { rows, cols };
}
