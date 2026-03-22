import { useSearchParams } from 'react-router';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { BookOpen, Inbox, Star, Archive, Trash2, Tag } from 'lucide-react';
import { useFilterCounts, useTagCounts } from '@/features/articles/hooks';

export function AppSidebar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: counts } = useFilterCounts();
  const { data: tagCounts } = useTagCounts();
  const { isMobile, setOpenMobile } = useSidebar();

  const currentFilter = searchParams.get('filter') || 'active';
  const currentTag = searchParams.get('tag') || null;

  const setFilter = (filter: string) => {
    const params = new URLSearchParams();
    params.set('filter', filter);
    setSearchParams(params);
    if (isMobile) setOpenMobile(false);
  };

  const setTag = (tag: string) => {
    const params = new URLSearchParams();
    params.set('filter', 'tag');
    params.set('tag', tag);
    setSearchParams(params);
    if (isMobile) setOpenMobile(false);
  };

  const mainItems = [
    { key: 'all', label: 'All Articles', icon: BookOpen, count: counts?.all },
    { key: 'active', label: 'Active', icon: Inbox, count: counts?.active },
    { key: 'favorites', label: 'Favorites', icon: Star, count: counts?.favorites },
    { key: 'archived', label: 'Archived', icon: Archive, count: counts?.archived },
    { key: 'deleted', label: 'Deleted', icon: Trash2, count: counts?.deleted },
  ];

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="px-2 py-1">
          <h2 className="text-lg font-bold text-sidebar-foreground">Read Later²</h2>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map(item => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    isActive={currentFilter === item.key && !currentTag}
                    onClick={() => setFilter(item.key)}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  {item.count !== undefined && item.count > 0 && (
                    <SidebarMenuBadge>{item.count}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {tagCounts && tagCounts.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Tags</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {tagCounts.map(([tag, count]) => (
                  <SidebarMenuItem key={tag}>
                    <SidebarMenuButton
                      isActive={currentTag === tag}
                      onClick={() => setTag(tag)}
                    >
                      <Tag />
                      <span>{tag}</span>
                    </SidebarMenuButton>
                    <SidebarMenuBadge>{count}</SidebarMenuBadge>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
