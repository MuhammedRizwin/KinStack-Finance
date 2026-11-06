export type Loan = {id:string; borrower:string; amount:number; currency:string; date:string; due:string; notes?:string};
export type Repayment = {id:string; loan_id:string; amount:number; date:string; method:string; reference:string};
export function loanRepaid(loanId:string, repayments:Repayment[]) {
  return repayments.filter(p=>p.loan_id===loanId).reduce((sum,p)=>sum+Number(p.amount),0);
}
export function loanStatus(loan:Loan, repayments:Repayment[], today:string) {
  const repaid=loanRepaid(loan.id,repayments);
  return repaid>=loan.amount?'Repaid':loan.due<today?'Overdue':loan.due===today?'Due today':repaid>0?'Part repaid':'Outstanding';
}
export function loanCashFlow(loans:Loan[], repayments:Repayment[], currency:string, month='') {
  const selected=loans.filter(l=>l.currency===currency);
  const ids=new Set(selected.map(l=>l.id));
  const given=selected.filter(l=>!month||l.date.startsWith(month)).reduce((sum,l)=>sum+Number(l.amount),0);
  const returned=repayments.filter(p=>ids.has(p.loan_id)&&(!month||p.date.startsWith(month))).reduce((sum,p)=>sum+Number(p.amount),0);
  const outstanding=selected.reduce((sum,l)=>sum+Number(l.amount)-loanRepaid(l.id,repayments),0);
  return {given,returned,outstanding,net:returned-given};
}
