export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionStatus = 'pending' | 'confirmed' | 'dismissed';

export interface PendingTransaction {
  id: string;
  user_id: string;
  raw_sms: string;
  sender: string | null;
  amount: number | null;
  amount_before_tax: number | null;
  transaction_date: string | null;
  transaction_time: string | null;
  account_number: string | null;
  item_name: string | null;
  transaction_type: TransactionType | null;
  category: string | null;
  memo: string | null;
  status: TransactionStatus;
  parsed_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

