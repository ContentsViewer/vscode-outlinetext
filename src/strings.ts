
/**
 * Returns last index of the string that is not whitespace.
 * If string is empty or contains only whitespaces, returns -1
 */
export function lastNonWhitespaceIndex(str: string, startIndex: number = str.length - 1): number {
	for (let i = startIndex; i >= 0; i--) {
		const chCode = str.charCodeAt(i);
		// Space: 32
		// Tab: 9
		if (chCode !== 32 && chCode !== 9) {
			return i;
		}
	}
	return -1;
}