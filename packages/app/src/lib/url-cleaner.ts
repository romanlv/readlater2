/**
 * Cleans a URL by removing tracking parameters (UTM, fbclid, etc.)
 * and normalizing the URL format.
 */
export function cleanUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // List of tracking parameters to remove
    const trackingParams = [
      // UTM parameters
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'utm_id',
      'utm_source_platform',
      'utm_creative_format',
      'utm_marketing_tactic',

      // Facebook
      'fbclid',
      'fb_action_ids',
      'fb_action_types',
      'fb_ref',
      'fb_source',

      // Google
      'gclid',
      'gclsrc',
      'dclid',

      // Other common tracking params
      'mc_cid',
      'mc_eid',
      '_ga',
      '_gl',
      'msclkid',
      'twclid',
      'li_fat_id',
      'igshid',
      'wickedid',
      'yclid',
    ];

    // Remove tracking parameters
    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });

    // Remove hash fragment if it's empty or just tracking
    if (urlObj.hash === '#' || urlObj.hash === '') {
      urlObj.hash = '';
    }

    return urlObj.toString();
  } catch (error) {
    // If URL parsing fails, return original URL
    console.error('Failed to clean URL:', error);
    return url;
  }
}

/**
 * Validates if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
