export const formatTranscript = (text: string): string => {
    if (!text) return ''

    let formatted = text
        // Normalize spacing
        .replace(/\s+/g, ' ')
        .trim()

    // Basic filler word removal (very naive list)
    const fillers = ['um', 'uh', 'like', 'you know', 'sort of']
    fillers.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi')
        formatted = formatted.replace(regex, '')
    })

    // Fix basic punctuation spacing
    formatted = formatted
        .replace(/\s+([.,!?])/g, '$1')
        .replace(/([.,!?])(\w)/g, '$1 $2')

    // Capitalize first letter
    formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1)

    return formatted
}
