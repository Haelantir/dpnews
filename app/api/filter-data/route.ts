import filterData from '@/lib/filter-data.json';

const HEADERS = { 'Cache-Control': 'no-store' };

export async function GET() {
  return Response.json(filterData, { headers: HEADERS });
}
