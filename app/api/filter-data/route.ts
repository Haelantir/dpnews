import filterData from '@/lib/filter-data.json';

const HEADERS = { 'Cache-Control': 'public, s-maxage=86400, max-age=0, must-revalidate' };

export async function GET() {
  return Response.json(filterData, { headers: HEADERS });
}
