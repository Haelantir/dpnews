import { getFilterData } from '@/lib/server-data';

export async function GET() {
  return Response.json(getFilterData());
}
