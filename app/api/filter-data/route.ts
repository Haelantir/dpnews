import filterData from '@/lib/filter-data.json';

const HEADERS = { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' };

export async function GET() {
  return Response.json(filterData, { headers: HEADERS });
}
