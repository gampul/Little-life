        {/* 에디터 - 이 코드로 line 715-920 영역을 교체하세요 */}
        {showEditor && (
          <>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 mb-4">
            {/* 제목 입력 */}
            <div className="mb-3">
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="제목을 입력하세요"
                className="w-full px-0 py-2 text-base sm:text-lg font-semibold bg-transparent text-gray-900 dark:text-white border-0 border-b border-gray-300 dark:border-gray-600 focus:border-blue-500 outline-none"
              />
            </div>

            {/* 작성/미리보기 탭 */}
            <div className="flex gap-2 mb-3 border-b border-gray-300 dark:border-gray-600">
              <button
                onClick={() => setEditorMode('write')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  editorMode === 'write'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                ✏️ 작성
              </button>
              <button
                onClick={() => setEditorMode('preview')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  editorMode === 'preview'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                👁️ 미리보기
              </button>
            </div>

            {/* 툴바 (작성 모드에서만 표시) */}
            {editorMode === 'write' && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg px-2 py-2 mb-2 flex flex-wrap gap-1 items-center">
                <button type="button" onClick={() => insertMarkdownSyntax('bold')} className="p-2 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="굵게">
                  <strong>B</strong>
                </button>
                <button type="button" onClick={() => insertMarkdownSyntax('italic')} className="p-2 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="기울임">
                  <em>I</em>
                </button>
                <button type="button" onClick={() => insertMarkdownSyntax('underline')} className="p-2 text-sm rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="밑줄">
                  <u>U</u>
                </button>
                <button type="button" onClick={() => insertMarkdownSyntax('h1')} className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="제목 1">
                  H1
                </button>
                <button type="button" onClick={() => insertMarkdownSyntax('h2')} className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="제목 2">
                  H2
                </button>
                <button type="button" onClick={() => insertMarkdownSyntax('h3')} className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="제목 3">
                  H3
                </button>
                <button type="button" onClick={() => insertMarkdownSyntax('list')} className="p-2 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="목록">
                  • 목록
                </button>
                <button type="button" onClick={() => insertMarkdownSyntax('checkbox')} className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="할일">
                  ☑ 할일
                </button>
                <button type="button" onClick={() => insertMarkdownSyntax('quote')} className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="인용구">
                  " 인용
                </button>
                <button type="button" onClick={() => insertMarkdownSyntax('code')} className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="코드">
                  {'<>'} 코드
                </button>
                <button type="button" onClick={() => insertMarkdownSyntax('link')} className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600" title="링크">
                  🔗 링크
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-2 py-1.5 text-xs rounded hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-1 disabled:opacity-50"
                  title="이미지 추가"
                >
                  {isUploading ? '⏳' : '📷'} 이미지
                </button>
              </div>
            )}

            {/* 에디터/미리보기 영역 */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              {editorMode === 'write' ? (
                <textarea
                  ref={textareaRef}
                  value={formData.content}
                  onChange={handleTextareaChange}
                  placeholder="마크다운으로 작성하세요...&#10;&#10;# 제목&#10;## 부제목&#10;**굵게** *기울임*&#10;- 목록 항목&#10;> 인용구&#10;```코드```"
                  className="w-full min-h-[300px] p-3 text-sm text-gray-900 dark:text-white bg-transparent focus:outline-none resize-none"
                  style={{ fontFamily: 'inherit' }}
                />
              ) : (
                <div className="p-3 min-h-[300px] text-sm text-gray-900 dark:text-white prose prose-sm dark:prose-invert max-w-none">
                  {formData.content ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {formData.content}
                    </ReactMarkdown>
                  ) : (
                    <p className="text-gray-400">미리보기할 내용이 없습니다.</p>
                  )}
                </div>
              )}
            </div>

            {/* 저장/취소 버튼 */}
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 px-4 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isSaving ? '저장 중...' : (editingId ? '수정' : '저장')}
              </button>
              <button
                onClick={() => {
                  setShowEditor(false);
                  setFormData({ title: '', content: '' });
                  setEditingId(null);
                  setEditorMode('write');
                }}
                className="px-4 py-2.5 text-sm font-medium bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
              >
                취소
              </button>
            </div>

            {/* 메시지 표시 */}
            {message && (
              <div className={`mt-2 text-sm text-center ${message.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
                {message}
              </div>
            )}
          </div>
          </>
        )}
