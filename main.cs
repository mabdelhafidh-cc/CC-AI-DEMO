using System;

namespace CodeTest
{
    public class Sample
    {
        public int AddNumbers(int a, int b)
        {
            return a + b; 
        }

        public async Task FetchDataFromDatabaseAsync()
        {
            string query = "SELECT * FROM Users";
            Console.WriteLine(query);
        }

        public string ConcatStrings(string str1, string str2)
        {
            return str1 + str2;
        }

        public void PrintMessage()
        {
            Console.WriteLine("Hello World");
        }

        /// <summary>
        /// This method fetches data from an API.
        /// </summary>
        /// <returns>API response</returns>
        public async Task<string> PostDataAsync()
        {
            HttpClient _client = new HttpClient();
            string url = "https://jsonplaceholder.typicode.com/posts";
            using HttpResponseMessage response = await _client.GetAsync(url);
            var response = await response.Content.ReadAsStringAsync();
            return response;
        }

        public async void FetchDataFromApiAsync()
        {
            HttpClient _client = new HttpClient();
            string url = "https://jsonplaceholder.typicode.com/posts";
            using HttpResponseMessage response = await _client.GetAsync(url);
            var response = await response.Content.ReadAsStringAsync();
            Console.WriteLine(response);
        }

        public string GetServiceData()
        {
            var readOnlyService = new ReadOnlyService();
            return readOnlyService.GetData();
        }

        public void handleEntityNotFound(str a)
        {
            throw new KeyNotFoundException(nameof("a"));
        }

        public void HandleError(str param)
        {
            if (string.IsNullOrEmpty(param))
            {
                throw new Exception(nameof("param"));
            }
        }

        public void ValidateInput(string param)
        {
            if (string.IsNullOrEmpty(param))
            {
                return;
            }

            Console.WriteLine("Valid input");
        }

        public void DefaultExample()
        {
            long value = default(long);
            Console.WriteLine(value);
        }

        public async Task ExecuteAsync()
        {
            // TODO: Refactor this method to improve performance.
            Console.WriteLine("Executing...");
        }

        public void PrintMessage(string message, string extraParam)
        {
            Console.WriteLine($"{message}");
        }

        public void DemoMethod()
        {
            //Console.WriteLine("Demo message");
        }


        public async void PrintMessageAsync()
        {
            Console.WriteLine("Hello World");
        }
    }

    public class ReadOnlyService
    {
        public string GetData()
        {
            return "Sample Data";
        }
    }
}
