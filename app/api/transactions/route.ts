// Legacy endpoint disabled: all access goes through workspace role checks.
export async function GET(){return Response.json({error:'Please refresh the app.'},{status:410});}
export const POST=GET;export const DELETE=GET;
