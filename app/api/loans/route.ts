import {access,failure} from '../../../lib/finance-server';
import {cents,validDate} from '../../../lib/finance';
const text=(v:unknown,max=200)=>String(v??'').trim().slice(0,max);
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function dbError(error:{code?:string;message:string}) {
  if(error.code==='23505')throw Error('409:This entry was already saved. Refresh before trying again.');
  if(error.code==='23503')throw Error('409:Remove repayments before deleting this loan.');
  if(error.code==='23514')throw Error('400:'+error.message);
  if(error.code==='42501')throw Error('403:You do not have permission to change loans.');
  throw Error('Unable to save loan records. Please try again.');
}
export async function POST(request:Request) {
  try {
    const a=await access(true),b=await request.json();
    if(!uuid(b.id))throw Error('400:Invalid entry ID.');
    if(b.action==='loan') {
      if(!text(b.borrower,120)||!cents(b.amount)||!['INR','AED'].includes(b.currency)||!validDate(b.date)||!validDate(b.due)||b.due<b.date||b.date>today())throw Error('400:Check the borrower, amount, currency and dates.');
      const row={borrower:text(b.borrower,120),amount:b.amount,currency:b.currency,date:b.date,due:b.due,notes:text(b.notes,2000)};
      const saved=b.existing
        ? await a.supabase.from('finance_loans').update(row).eq('id',b.id).eq('workspace_id',a.workspaceId).select('id').maybeSingle()
        : await a.supabase.from('finance_loans').insert({...row,id:b.id,workspace_id:a.workspaceId}).select('id').single();
      if(saved.error)dbError(saved.error);
      if(!saved.data)throw Error('400:Loan not found.');
    } else if(b.action==='repayment') {
      if(!uuid(b.loan_id)||!cents(b.amount)||!validDate(b.date)||b.date>today()||!['Bank transfer','UPI','Cash','Card','Other'].includes(b.method))throw Error('400:Check the repayment amount, date and method.');
      const saved=await a.supabase.from('finance_loan_repayments').insert({id:b.id,workspace_id:a.workspaceId,loan_id:b.loan_id,amount:b.amount,date:b.date,method:b.method,reference:text(b.reference)});
      if(saved.error)dbError(saved.error);
    } else throw Error('400:Unknown loan action.');
    return Response.json({ok:true});
  }catch(error){return failure(error);}
}
export async function DELETE(request:Request) {
  try {
    const a=await access(true),b=await request.json();
    if(!uuid(b.id)||!['loan','repayment'].includes(b.action))throw Error('400:Invalid entry.');
    const removed=await a.supabase.from(b.action==='loan'?'finance_loans':'finance_loan_repayments').delete().eq('workspace_id',a.workspaceId).eq('id',b.id).select('id').maybeSingle();
    if(removed.error)dbError(removed.error);
    if(!removed.data)throw Error('400:Entry not found.');
    return Response.json({ok:true});
  }catch(error){return failure(error);}
}
