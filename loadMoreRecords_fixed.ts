// ============================================
// FIXED VERSION - Your Original Code with Bug Fixes
// ============================================
// Issues fixed:
// 1. Removed offset from dependency array (prevents unnecessary callback recreation)
// 2. Fixed hasMore calculation to use the NEW offset value instead of stale one
// 3. Used useRef for offset to avoid stale closure issues

const ITEMS_PER_PAGE = 10;

// Required state variables:
// const [memos, setMemos] = useState([]);
// const [loading, setLoading] = useState(false);
// const [hasMore, setHasMore] = useState(true);
// const [error, setError] = useState<string | null>(null);
// const offsetRef = useRef(0); // Use ref instead of state for offset

const loadMoreRecords = useCallback(async () => {
  if (loading || !hasMore) return;

  setLoading(true);
  setError(null);

  try {
    const currentOffset = offsetRef.current;
    
    const { data, error, count } = await supabase
      .from('memos')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(currentOffset, currentOffset + ITEMS_PER_PAGE - 1);

    if (error) {
      console.error('메모 목록 조회 오류:', error);
      setError('메모를 불러오는데 실패했습니다.');
      return;
    }

    if (data) {
      setMemos(prev => [...prev, ...data]);
      
      // Update offset in ref
      const newOffset = currentOffset + ITEMS_PER_PAGE;
      offsetRef.current = newOffset;
      
      // ✅ FIX: Calculate hasMore using the NEW offset value (not the stale one)
      if (count !== null) {
        setHasMore(newOffset < count);
      } else {
        // If count is not available, check if we got a full page
        setHasMore(data.length === ITEMS_PER_PAGE);
      }
    } else {
      setHasMore(false);
    }
  } catch (err) {
    console.error('예상치 못한 오류:', err);
    setError('메모를 불러오는데 실패했습니다.');
  } finally {
    setLoading(false);
  }
}, [loading, hasMore, supabase]); // ✅ FIX: Removed offset from deps, use ref instead

// Reset function (useful for refreshing the list)
const resetRecords = useCallback(() => {
  offsetRef.current = 0;
  setMemos([]);
  setHasMore(true);
  setError(null);
  loadMoreRecords();
}, [loadMoreRecords]);
