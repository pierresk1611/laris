import { prisma } from '@/lib/prisma';
import MappingClient from './MappingClient';

export const dynamic = 'force-dynamic';

export default async function MappingPage() {
    // 1. Fetch all WebProducts
    const webProducts = await prisma.webProduct.findMany({
        orderBy: { title: 'asc' },
    });

    // 2. Fetch all Active Templates
    const templates = await prisma.template.findMany({
        orderBy: { key: 'asc' },
        select: {
            id: true,
            key: true,
            name: true,
            status: true,
            imageUrl: true
        }
    });

    return (
        <div className="p-8 max-w-[1400px] mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Mapovanie SKU</h1>
                <p className="text-slate-500 mt-2">
                    Priraďte produkty stiahnuté z e-shopu k fyzickým šablónam. Tento záznam má absolútnu prioritu
                    pred automatickým AI mapovaním.
                </p>
            </div>

            <MappingClient initialProducts={webProducts} templates={templates} />
        </div>
    );
}
