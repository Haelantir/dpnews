import filterData from '@/lib/filter-data.json';

export async function GET() {
  return Response.json(filterData);
}
