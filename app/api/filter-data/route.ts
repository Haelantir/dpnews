import filterData from '@/lib/filter-data.json';

const HEADERS = { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800' };

export async function GET() {
  return Response.json(filterData, { headers: HEADERS });
}
