from django.contrib import admin

from wiki.models import ProcessDefinition, TicketPageLink, WikiPage, WikiPageVersion, WikiSpace


@admin.register(WikiSpace)
class WikiSpaceAdmin(admin.ModelAdmin):
    list_display = ["name", "project", "created_by", "created_at"]


@admin.register(WikiPage)
class WikiPageAdmin(admin.ModelAdmin):
    list_display = ["title", "project", "parent", "updated_at"]
    search_fields = ["title", "content"]
    list_filter = ["project"]


@admin.register(WikiPageVersion)
class WikiPageVersionAdmin(admin.ModelAdmin):
    list_display = ["page", "version_number", "created_by", "created_at"]
    list_filter = ["page"]


@admin.register(TicketPageLink)
class TicketPageLinkAdmin(admin.ModelAdmin):
    list_display = ["issue", "wiki_page", "linked_by", "created_at"]


@admin.register(ProcessDefinition)
class ProcessDefinitionAdmin(admin.ModelAdmin):
    list_display  = ["wiki_page", "project", "category", "is_active", "priority", "created_at"]
    list_filter   = ["category", "is_active", "project"]
    search_fields = ["wiki_page__title"]
    readonly_fields = ["created_at", "updated_at"]
