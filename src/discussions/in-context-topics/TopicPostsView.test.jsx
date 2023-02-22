import {
  fireEvent, render, screen, waitFor, within,
} from '@testing-library/react';
import MockAdapter from 'axios-mock-adapter';
import { act } from 'react-dom/test-utils';
import { IntlProvider } from 'react-intl';
import { generatePath, MemoryRouter, Route } from 'react-router';
import { Factory } from 'rosie';

import { initializeMockApp } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient } from '@edx/frontend-platform/auth';
import { AppProvider } from '@edx/frontend-platform/react';

import { PostActionsBar } from '../../components';
import { Routes } from '../../data/constants';
import { initializeStore } from '../../store';
import { executeThunk } from '../../test-utils';
import { DiscussionContext } from '../common/context';
import { fetchThreads } from '../posts/data/thunks';
import { getCourseTopicsApiUrl, getThreadsApiUrl } from './data/api';
import { selectCoursewareTopics, selectNonCoursewareTopics } from './data/selectors';
import { fetchCourseTopicsV3 } from './data/thunks';
import TopicPostsView from './TopicPostsView';
import TopicsView from './TopicsView';

import './data/__factories__';
import '../posts/data/__factories__/threads.factory';

const courseId = 'course-v1:edX+DemoX+Demo_Course';
const threadsApiUrl = getThreadsApiUrl();
const topicsApiUrl = `${getCourseTopicsApiUrl()}`;
let store;
let axiosMock;
let lastLocation;
let container;

async function renderComponent({
  topicId, category, enableInContextSidebar = false,
} = { myPosts: false }) {
  let path = `/${courseId}/topics/`;
  let page = 'topics';
  if (topicId) {
    path = generatePath(Routes.POSTS.PATH, { courseId, topicId });
    page = 'posts';
  } else if (category) {
    path = generatePath(Routes.TOPICS.CATEGORY, { courseId, category });
    page = 'category';
  }
  const wrapper = await render(
    <IntlProvider locale="en">
      <AppProvider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <DiscussionContext.Provider value={{
            courseId,
            topicId,
            category,
            page,
            enableInContextSidebar,
          }}
          >
            <Route
              path={[Routes.POSTS.PATH, Routes.TOPICS.CATEGORY]}
              component={TopicPostsView}
            />
            <Route exact path="/:courseId/topics/">
              <PostActionsBar />
              <TopicsView />
            </Route>
            <Route
              render={({ location }) => {
                lastLocation = location;
                return null;
              }}
            />
          </DiscussionContext.Provider>
        </MemoryRouter>
      </AppProvider>
    </IntlProvider>,
  );
  container = wrapper.container;
}

describe('InContext Topic Posts View', () => {
  let nonCoursewareTopics;
  let coursewareTopics;

  beforeEach(() => {
    initializeMockApp({
      authenticatedUser: {
        userId: 3,
        username: 'abc123',
        administrator: true,
        roles: [],
      },
    });

    store = initializeStore({
      config: {
        enableInContext: true,
        provider: 'openedx',
        hasModerationPrivileges: true,
        blackouts: ['2021-12-31T10:15', '2021-12-31T10:20'],
        visibility: false,
        status: 'successful',
      },
    });
    Factory.resetAll();
    axiosMock = new MockAdapter(getAuthenticatedHttpClient());
    lastLocation = undefined;
  });

  async function setupTopicsMockResponse() {
    axiosMock.onGet(`${topicsApiUrl}${courseId}`)
      .reply(200, (Factory.buildList('topic', 1, null, {
        topicPrefix: 'noncourseware-topic',
        enabledInContext: true,
        topicNamePrefix: 'general-topic',
        usageKey: '',
        courseware: false,
        discussionCount: 1,
        questionCount: 1,
      }).concat(Factory.buildList('section', 2, null, { topicPrefix: 'courseware' })))
        .concat(Factory.buildList('archived-topics', 2, null)));
    await executeThunk(fetchCourseTopicsV3(courseId), store.dispatch, store.getState);

    const state = store.getState();
    nonCoursewareTopics = selectNonCoursewareTopics(state);
    coursewareTopics = selectCoursewareTopics(state);
  }

  async function setupPostsMockResponse(id, count = 3) {
    axiosMock.onGet(threadsApiUrl)
      .reply(() => {
        const threadAttrs = { previewBody: 'thread preview body' };
        return [200, Factory.build('threadsResult', {}, {
          topicId: id,
          threadAttrs,
          count,
        })];
      });
    await executeThunk(fetchThreads(courseId), store.dispatch, store.getState);
  }

  test.each([
    { parent: nonCoursewareTopics[0], topicType: 'NonCourseware' },
    { parent: coursewareTopics[0].children[0].children[0], topicType: 'courseware' },
  ])('\'$topicType\' topic should have a required number of post lengths.', async ({ parent }) => {
    await setupTopicsMockResponse();

    await act(async () => {
      setupPostsMockResponse(parent.id, 3);
      renderComponent({ topicId: parent.id });
    });

    await waitFor(async () => {
      const posts = await container.querySelectorAll('.discussion-post');

      expect(lastLocation.pathname.endsWith(`/topics/${parent.id}`)).toBeTruthy();
      expect(posts).toHaveLength(6);
    });
  });

  test.each([
    { parent: nonCoursewareTopics[0], topicType: 'NonCourseware' },
    { parent: coursewareTopics[0].children[0].children[0], topicType: 'courseware' },
  ])('\'$topicType\' topic should have a Back navigation bar with selected \'$topicType\' topic title.',
    async ({ parent }) => {
      await setupTopicsMockResponse();

      await act(async () => {
        setupPostsMockResponse(parent.id, 3);
        renderComponent({ topicId: parent.id });
      });

      await waitFor(async () => {
        const backButton = await screen.getByLabelText('Back to topics list');
        const parentHeader = await screen.findByText(parent.name);

        expect(backButton).toBeInTheDocument();
        expect(parentHeader).toBeInTheDocument();
      });
    });

  it('A back button should redirect from list of posts to list of units.', async () => {
    await setupTopicsMockResponse();
    const subSection = coursewareTopics[0].children[0];
    const unit = subSection.children[0];

    await act(async () => {
      setupPostsMockResponse(unit.id, 2);
      renderComponent({ topicId: unit.id });
    });

    const backButton = await screen.getByLabelText('Back to topics list');

    await act(async () => fireEvent.click(backButton));
    await waitFor(async () => {
      renderComponent({ topicId: undefined, category: subSection.id });

      const subSectionList = await container.querySelector('.list-group');
      const units = await subSectionList.querySelectorAll('.discussion-topic');
      const unitHeader = await within(subSectionList).queryByText(unit.name);

      expect(lastLocation.pathname.endsWith(`/category/${subSection.id}`)).toBeTruthy();
      expect(unitHeader).toBeInTheDocument();
      expect(units).toHaveLength(4);
    });
  });

  it('A back button should redirect from units to the parent/selected subsection.', async () => {
    await setupTopicsMockResponse();
    const subSection = coursewareTopics[0].children[0];

    renderComponent({ topicId: undefined, category: subSection.id });

    const backButton = await screen.getByLabelText('Back to topics list');

    await act(async () => fireEvent.click(backButton));
    await waitFor(async () => {
      renderComponent();

      const sectionList = await container.querySelector('.list-group');
      const subSections = await sectionList.querySelectorAll('.discussion-topic-group');
      const subSectionHeader = await within(sectionList).queryByText(subSection.displayName);

      expect(lastLocation.pathname.endsWith('/topics/')).toBeTruthy();
      expect(subSectionHeader).toBeInTheDocument();
      expect(subSections).toHaveLength(3);
    });
  });

  test.each([
    { searchText: 'hello world', output: 'Showing 0 results for' },
    { searchText: 'introduction', output: 'Showing 8 results for' },
  ])('It should have a search bar with a clear button and \'$output\' results found text.',
    async ({ searchText, output }) => {
      await setupTopicsMockResponse();
      await renderComponent();

      const searchField = await within(container).getByPlaceholderText('Search topics');
      const search = await container.querySelector('.pointer-cursor-hover');
      const searchButton = await search.querySelector('.pgn__icon');
      fireEvent.change(searchField, { target: { value: searchText } });

      await waitFor(async () => expect(searchField).toHaveValue(searchText));
      await act(async () => fireEvent.click(searchButton));
      await waitFor(async () => {
        const clearButton = await within(container).queryByText('Clear results');
        const searchMessage = await within(container).queryByText(`${output} "${searchText}"`);

        expect(searchMessage).toBeInTheDocument();
        expect(clearButton).toBeInTheDocument();
      });
    });

  it('When click on the clear button it should move to main topics pages.', async () => {
    await setupTopicsMockResponse();
    await renderComponent();

    const searchText = 'hello world';
    const searchField = await within(container).getByPlaceholderText('Search topics');
    const search = await container.querySelector('.pointer-cursor-hover');
    const searchButton = await search.querySelector('.pgn__icon');
    fireEvent.change(searchField, { target: { value: searchText } });

    await waitFor(async () => expect(searchField).toHaveValue(searchText));
    await act(async () => fireEvent.click(searchButton));
    await waitFor(async () => {
      const clearButton = await within(container).queryByText('Clear results');

      await act(async () => fireEvent.click(clearButton));
      await waitFor(async () => {
        const coursewareTopicList = await container.querySelectorAll('.discussion-topic-group');

        expect(coursewareTopicList).toHaveLength(3);
        expect(within(container).queryByText('Clear results')).not.toBeInTheDocument();
      });
    });
  });
});
