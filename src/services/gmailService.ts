import { MockEmail } from './mockData';

export async function fetchGmailEmails(accessToken: string, maxResults = 50): Promise<MockEmail[]> {
  try {
    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!listRes.ok) {
      if (listRes.status === 401) {
        throw new Error('UNAUTHORIZED');
      }
      if (listRes.status === 403) {
        throw new Error('FORBIDDEN');
      }
      throw new Error('Failed to fetch messages list');
    }
    
    const listData = await listRes.json();
    if (!listData.messages) return [];

    const emails: MockEmail[] = [];
    
    // Fetch details for each message in parallel
    const messagePromises = listData.messages.map(async (msg: any) => {
      const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (!msgRes.ok) return null;
      
      const msgData = await msgRes.json();
      const headers = msgData.payload.headers;
      
      const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
      
      // Parse sender to get just the name if possible, or the full string
      let sender = headers.find((h: any) => h.name.toLowerCase() === 'from')?.value || 'Unknown';
      const nameMatch = sender.match(/^"?([^"<]+)"?\s*</);
      if (nameMatch && nameMatch[1]) {
        sender = nameMatch[1].trim();
      }

      const dateStr = headers.find((h: any) => h.name.toLowerCase() === 'date')?.value;
      const date = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();
      
      // Try to extract body text
      let body = msgData.snippet || '';
      if (msgData.payload.parts) {
        const textPart = msgData.payload.parts.find((p: any) => p.mimeType === 'text/plain');
        if (textPart && textPart.body && textPart.body.data) {
          try {
            // Base64Url decode
            body = decodeURIComponent(escape(atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'))));
          } catch (e) {
            console.error("Failed to decode body", e);
          }
        }
      } else if (msgData.payload.body && msgData.payload.body.data) {
        try {
          body = decodeURIComponent(escape(atob(msgData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'))));
        } catch (e) {
          console.error("Failed to decode body", e);
        }
      }

      let category: 'primary' | 'promotions' | 'social' | 'updates' = 'primary';
      if (msgData.labelIds) {
        if (msgData.labelIds.includes('CATEGORY_PROMOTIONS')) category = 'promotions';
        else if (msgData.labelIds.includes('CATEGORY_SOCIAL')) category = 'social';
        else if (msgData.labelIds.includes('CATEGORY_UPDATES')) category = 'updates';
      }

      return {
        id: msg.id,
        subject,
        snippet: msgData.snippet || '',
        sender,
        date,
        unread: msgData.labelIds?.includes('UNREAD') || false,
        starred: msgData.labelIds?.includes('STARRED') || false,
        category,
        messages: [{ id: msg.id, sender, body, date }]
      } as MockEmail;
    });

    const resolvedMessages = await Promise.all(messagePromises);
    
    // Filter out nulls and sort by date descending
    return resolvedMessages
      .filter((m): m is MockEmail => m !== null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
  } catch (error) {
    console.error("Error fetching Gmail emails:", error);
    throw error;
  }
}
